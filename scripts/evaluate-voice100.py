"""Development-only diagnosis of the actual100-clip checkpoint. No training,
held inference, production promotion, microphone or native desktop action.
"""
import os,sys,pathlib,uuid,json,hashlib,time,wave,unicodedata
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',OMP_NUM_THREADS='3',OPENBLAS_NUM_THREADS='3')
root=pathlib.Path(__file__).resolve().parents[1];operation,mode=sys.argv[1:];uuid.UUID(operation)
if mode not in ['head-evaluate100','head-evaluate100-refined']:raise ValueError('mode')
run=root/'.tools'/'voice-training'/operation;run.mkdir(exist_ok=False);started=time.monotonic()
report={'version':1,'operationId':operation,'mode':mode,'newUniqueClips':0,'trainingUpdates':0,'productionModified':False,'fullSpeechAccepted':False,'rows':[],'held12Used':False}
def digest(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for b in iter(lambda:f.read(1048576),b''):h.update(b)
    return h.hexdigest()
def save():
    report['elapsedMs']=round((time.monotonic()-started)*1000);(run/'PROGRESS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
def norm(text):return ''.join(c for c in unicodedata.normalize('NFC',text).lower() if not c.isspace() and not unicodedata.category(c).startswith('P'))
def distance(a,b):
    row=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        nxt=[i]
        for j,y in enumerate(b,1):nxt.append(min(nxt[-1]+1,row[j]+1,row[j-1]+(x!=y)))
        row=nxt
    return row[-1]
try:
    import numpy as np,torch
    from transformers import Wav2Vec2Config,Wav2Vec2ForCTC
    from safetensors.torch import load_file
    torch.set_num_threads(3);torch.set_num_interop_threads(1)
    pointer=json.loads((root/('.tools/voice-training/REFINED-100-CURRENT.json' if mode=='head-evaluate100-refined' else '.tools/voice-training/CANDIDATE-PILOT-CURRENT.json')).read_text(encoding='utf8'));base=root/'.tools/voice-training'/pointer['operationId']
    if len(pointer['trainedClipIds'])!=100 or digest(base/'head.safetensors')!=pointer['checkpointSha256']:raise ValueError('actual100 checkpoint required')
    source=root/'.tools/voice-models/wav2vec2-th-cv8-source-v1';manifest=json.loads((source/'SOURCE-MANIFEST.json').read_text(encoding='utf8'))
    entry=next(f for f in manifest['downloadedFiles'] if f['file']=='model.safetensors')
    if entry['sha256']!=pointer['sourceWeightsSha256'] or digest(source/'model.safetensors')!=entry['sha256']:raise ValueError('base weights integrity')
    cfg=Wav2Vec2Config.from_json_file(str(source/'config.json'));cfg._attn_implementation='eager';model=Wav2Vec2ForCTC(cfg);weights=load_file(str(source/'model.safetensors'));model.load_state_dict(weights,strict=True);del weights
    vocabulary=json.loads((base/'vocab.json').read_text(encoding='utf8'));reverse={i:c for c,i in vocabulary.items()};head=torch.nn.Linear(cfg.hidden_size,len(vocabulary));head.load_state_dict(load_file(str(base/'head.safetensors')),strict=True);model.eval();head.eval()
    plan=json.loads((root/'validation/2026-10-13-short-speech/PLAN-before-inference.json').read_text(encoding='utf8'))
    report.update({'checkpointOperation':pointer['operationId'],'checkpointSha256':pointer['checkpointSha256'],'modelSetupMs':round((time.monotonic()-started)*1000),'evaluation':'unchanged original development only; raw acoustic model diagnosis, not productionVAD/microphone/task acceptance'})
    for clip in plan['development']:
        file=pathlib.Path(clip['file'])
        if digest(file)!=clip['sha256']:raise ValueError('frozen development audio changed')
        with wave.open(str(file),'rb') as audio:
            if (audio.getnchannels(),audio.getsampwidth(),audio.getframerate())!=(1,2,16000):raise ValueError('development format')
            samples=np.frombuffer(audio.readframes(audio.getnframes()),dtype='<i2').astype(np.float32)/32768
        began=time.monotonic();values=(samples-samples.mean())/np.sqrt(samples.var()+1e-7)
        with torch.inference_mode():tokens=head(model.wav2vec2(torch.from_numpy(values).unsqueeze(0)).last_hidden_state).argmax(-1).squeeze(0).tolist()
        emitted=[];previous=None
        for token in tokens:
            if token!=previous and token!=69:emitted.append(reverse[token])
            previous=token
        text=''.join(emitted).replace('|',' ').strip();errors=distance(norm(clip['reference']),norm(text))
        report['rows'].append({'id':clip['id'],'category':clip.get('category'),'reference':clip['reference'],'sha256':clip['sha256'],'rawText':text,'normalizedExact':norm(text)==norm(clip['reference']),'rawExact':text==clip['reference'],'characterErrors':errors,'referenceCharacters':len(norm(clip['reference'])),'modelProcessingMs':round((time.monotonic()-began)*1000),'specialTokenEmitted':any(t in text for t in ['[UNK]','<s>','</s>']),'timingStartsAt':'already available decoded waveform, not human speech end'})
        save();print('evaluated:'+clip['id'],file=sys.stderr,flush=True)
    positive=[r for r in report['rows'] if r['reference']];negative=[r for r in report['rows'] if not r['reference']]
    report['summary']={'speechClips':len(positive),'speechExact':sum(r['normalizedExact'] for r in positive),'knownShortStopExact':next(r['normalizedExact'] for r in positive if r['id']=='control-5'),'rawNonSpeechTranscripts':sum(bool(r['rawText']) for r in negative),'eligibleForPipelineAcceptance':False,'productionVADAndConfidenceNotEvaluated':True};report['state']='succeeded';save();print(json.dumps(report,ensure_ascii=False),flush=True)
except Exception as e:
    report.update(state='failed',error=str(e));save();print(json.dumps(report,ensure_ascii=False),flush=True);raise
