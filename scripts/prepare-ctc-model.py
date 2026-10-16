"""Owned backend model-artifact preparation: public weights, local CPU, no training."""
import os,pathlib,sys,json,time,hashlib,shutil,ctypes,gc
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',OMP_NUM_THREADS='3',OPENBLAS_NUM_THREADS='3')
def offline(event,args):
    if event in ['socket.connect','socket.getaddrinfo']:raise RuntimeError('network-disabled')
sys.addaudithook(offline)
source,output,temporary=[pathlib.Path(p).resolve() for p in sys.argv[1:]]
repository=pathlib.Path(__file__).resolve().parents[1];parent=(repository/'.tools'/'voice-models').resolve()
catalog={'wav2vec2-th-int8-v1':('wav2vec2-th-source-v1','airesearch/wav2vec2-large-xlsr-53-th','wav2vec2-thai-int8-v1','pytorch_model.bin'),'wav2vec2-th-cv8-int8-v1':('wav2vec2-th-cv8-source-v1','wannaphong/wav2vec2-large-xlsr-53-th-cv8-newmm','wav2vec2-thai-cv8-int8-v1','model.safetensors')}
if output.name not in catalog:raise ValueError('invalid-artifact-path')
source_name,source_id,artifact_id,weights_name=catalog[output.name]
if not parent.is_relative_to(repository) or source.parent!=parent or output.parent!=parent or source.name!=source_name or temporary.parent!=output.parent or not temporary.name.startswith(output.name+'.prepare-'):raise ValueError('invalid-artifact-path')
manifest=json.loads((source/'SOURCE-MANIFEST.json').read_text(encoding='utf-8'))
if manifest.get('id')!=source_id:raise ValueError('invalid-source')
if (output/'ARTIFACT.json').exists():
    ready=json.loads((output/'ARTIFACT.json').read_text(encoding='utf-8'))
    if ready['sourceRevision']!=manifest['revision']:raise ValueError('different-artifact-source')
    for file in ready['files']:
        if hashlib.sha256((output/file['file']).read_bytes()).hexdigest()!=file['sha256']:raise ValueError('artifact-integrity')
    print(json.dumps(ready));sys.exit(0)
if output.exists():raise ValueError('incomplete-existing-artifact')
temporary.mkdir(exist_ok=False);started=time.monotonic()

def peak_memory_mib():
    if sys.platform!='win32':return None
    class Counters(ctypes.Structure):
        _fields_=[('cb',ctypes.c_ulong),('PageFaultCount',ctypes.c_ulong)]+[(n,ctypes.c_size_t)for n in ['PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage','PrivateUsage']]
    c=Counters();c.cb=ctypes.sizeof(c);ctypes.windll.kernel32.GetCurrentProcess.restype=ctypes.c_void_p
    f=ctypes.windll.psapi.GetProcessMemoryInfo;f.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_ulong]
    if not f(ctypes.windll.kernel32.GetCurrentProcess(),ctypes.byref(c),c.cb):return None
    return round(c.PeakWorkingSetSize/1048576,2)
def verify_memory_budget():
    peak=peak_memory_mib()
    if weights_name=='model.safetensors' and (peak is None or peak>6144):raise ValueError('model-memory-budget')
    return peak

def stage(name):
    (temporary/'PREPARE-PROGRESS.json').write_text(json.dumps({'stage':name,'elapsedSeconds':time.monotonic()-started,'privateAudio':False}),encoding='utf-8')
    print('stage:'+name,file=sys.stderr,flush=True)
    verify_memory_budget()
try:
    stage('imports')
    import numpy as np,torch,onnxruntime as ort
    from transformers import Wav2Vec2Config,Wav2Vec2ForCTC
    from onnxruntime.quantization import quantize_dynamic,QuantType
    torch.set_num_threads(3);torch.set_num_interop_threads(1)
    config=Wav2Vec2Config.from_json_file(str(source/'config.json'));config._attn_implementation='eager'
    if config.model_type!='wav2vec2':raise ValueError('invalid-architecture')
    stage('load-weights-only')
    model=Wav2Vec2ForCTC(config)
    if weights_name=='model.safetensors':
        from safetensors.torch import load_file
        weights=load_file(str(source/weights_name),device='cpu')
    else:weights=torch.load(source/weights_name,map_location='cpu',weights_only=True)
    model.load_state_dict(weights,strict=True);del weights;model.eval()
    for p in model.parameters():p.requires_grad_(False)
    class Export(torch.nn.Module):
        def __init__(self,model):super().__init__();self.model=model
        def forward(self,input_values):return self.model(input_values).logits
    wrapper=Export(model).eval();raw=temporary/'model-float.onnx';quantized=temporary/'model-int8.onnx'
    stage('export')
    sample=torch.linspace(-.01,.01,16000).unsqueeze(0)
    with torch.no_grad():torch.onnx.export(wrapper,(sample,),str(raw),input_names=['input_values'],output_names=['logits'],dynamic_axes={'input_values':{0:'batch',1:'samples'},'logits':{0:'batch',1:'frames'}},opset_version=17,dynamo=False)
    del wrapper,model;gc.collect()
    stage('quantize')
    quantize_dynamic(str(raw),str(quantized),weight_type=QuantType.QInt8,op_types_to_quantize=['MatMul','Gemm'])
    stage('dynamic-shape-checks')
    options=ort.SessionOptions();options.intra_op_num_threads=3;options.inter_op_num_threads=1
    session=ort.InferenceSession(str(quantized),sess_options=options,providers=['CPUExecutionProvider'])
    shapes=[]
    for length in [8000,16000,24000]:
        values=np.linspace(-.01,.01,length,dtype=np.float32).reshape(1,-1)
        logits=session.run(['logits'],{'input_values':values})[0]
        if logits.ndim!=3 or logits.shape[0]!=1 or logits.shape[-1]!=config.vocab_size or not np.isfinite(logits).all():raise ValueError('invalid-export-output')
        shapes.append({'samples':length,'logitsShape':list(logits.shape)})
    del session;raw.unlink();gc.collect();verify_memory_budget()
    for name in ['vocab.json','preprocessor_config.json','config.json']:shutil.copyfile(source/name,temporary/name)
    files=[]
    for name in ['model-int8.onnx','vocab.json','preprocessor_config.json','config.json']:
        file=temporary/name;h=hashlib.sha256()
        with file.open('rb') as f:
            while chunk:=f.read(1048576):h.update(chunk)
        files.append({'file':name,'bytes':file.stat().st_size,'sha256':h.hexdigest()})
    ready={'artifactId':artifact_id,'sourceModel':manifest['id'],'sourceRevision':manifest['revision'],'sourceLicense':manifest['license'],'files':files,'dynamicShapes':shapes,'conversionSeconds':time.monotonic()-started,'peakMiB':verify_memory_budget(),'weightsTraining':False,'actualHumanInference':False,'networkAllowed':False,'engine':'ONNX Runtime CPU dynamic int8'}
    (temporary/'ARTIFACT.json').write_text(json.dumps(ready,indent=2),encoding='utf-8');temporary.rename(output)
    print(json.dumps(ready),flush=True)
finally:
    # Only this nonce's temporary conversion folder is removable.
    if temporary.exists() and temporary.parent==output.parent and temporary.name.startswith(output.name+'.prepare-'):shutil.rmtree(temporary)
