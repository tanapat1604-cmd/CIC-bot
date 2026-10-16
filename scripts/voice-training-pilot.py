"""Bounded public-data/real CTC head pilot. Invoked only by owned backend job.
No production configuration writes, no ASR spelling substitution, no evaluation
clips, no synthetic clips. Four clips are NOT the requested 100000 training.
"""
import os,sys,json,pathlib,hashlib,time,uuid,urllib.request,tarfile,io,wave,struct,ctypes
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',OMP_NUM_THREADS='3',OPENBLAS_NUM_THREADS='3',PYTHONUTF8='1')
root=pathlib.Path(__file__).resolve().parents[1]
operation,mode=sys.argv[1:];uuid.UUID(operation)
if mode not in ['acquire-pilot','head-pilot','head-batch100']:raise ValueError('invalid-mode')
directory=root/'.tools'/'voice-training'/operation;directory.mkdir(parents=True,exist_ok=False)
started=time.monotonic();report={'version':1,'operationId':operation,'mode':mode,'targetUniqueClips':100,'newUniqueClips':0,'trainingUpdates':0,'fullSpeechAccepted':False,'productionModified':False,'failures':[]}
def save():
    report['elapsedMs']=round((time.monotonic()-started)*1000)
    (directory/'PROGRESS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
def progress(stage):report['stage']=stage;save();print('stage:'+stage,file=sys.stderr,flush=True)
def hashfile(path):
    sha=hashlib.sha256()
    with open(path,'rb') as f:
        for b in iter(lambda:f.read(1048576),b''):sha.update(b)
    return sha.hexdigest()
if sys.platform=='win32':
    ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(),0x00004000)
sources=root/'validation'/'2026-10-14-training-corpus'
revision='70bb2e84b976b7e960aa89f1c648e09c59f894dd'
manifest=[];seen=set()
exclusions=json.loads((sources/'EXCLUSION-PCM-PILOT.json').read_text(encoding='utf8'))
excluded_pcm=set(exclusions['pcm_sha256'])
previous=None;trained_ids=set();pointer=root/'.tools'/'voice-training'/'CANDIDATE-PILOT-CURRENT.json'
if mode in ['head-pilot','head-batch100'] and pointer.exists():
    previous=json.loads(pointer.read_text(encoding='utf8'));uuid.UUID(previous['operationId'])
    prior=root/'.tools'/'voice-training'/previous['operationId']
    if hashfile(prior/'head.safetensors')!=previous['checkpointSha256'] or hashfile(prior/'MANIFEST.jsonl')!=previous['manifestSha256']:raise ValueError('resume integrity')
    trained_ids=set(previous['trainedClipIds'])
    if previous.get('optimizerSha256') and hashfile(prior/'optimizer.pt')!=previous['optimizerSha256']:raise ValueError('resume optimizer integrity')
    excluded_pcm.update(previous.get('trainedPCMHashes',[]))
    report['resumedFromOperation']=previous['operationId'];report['previousTrainedUniqueClips']=len(trained_ids)
class Budget:
    def __init__(self,response):self.response=response;self.count=0
    def read(self,size=-1):
        if size<0 or size>1048576:raise ValueError('unbounded network read')
        data=self.response.read(size);self.count+=len(data)
        if self.count>67108864:raise ValueError('compressed stream64MiB pilot budget exceeded')
        return data
def canonical(data):
    # FLEURS includes IEEE float WAV. Parse bounded RIFF chunks, never execute.
    import numpy as np
    if data[:4]!=b'RIFF' or data[8:12]!=b'WAVE':raise ValueError('not-WAV')
    at=12;fmt=None;pcm=None
    while at+8<=len(data):
        kind=data[at:at+4];n=struct.unpack_from('<I',data,at+4)[0];at+=8
        if at+n>len(data):raise ValueError('truncated-WAV')
        if kind==b'fmt ':fmt=struct.unpack_from('<HHIIHH',data,at)
        if kind==b'data':pcm=data[at:at+n]
        at+=n+n%2
    if not fmt or pcm is None:raise ValueError('missing-WAV-chunks')
    tag,channels,rate,_,align,bits=fmt
    if channels!=1 or rate!=16000:raise ValueError('not mono16k')
    if (tag,bits,align)==(1,16,2):values=np.frombuffer(pcm,dtype='<i2')
    elif (tag,bits,align)==(3,32,4):
        values=np.frombuffer(pcm,dtype='<f4')
        if not np.isfinite(values).all() or np.abs(values).max()>1.001:raise ValueError('invalid float samples')
        values=np.rint(np.clip(values,-1,1)*32767).astype('<i2')
    else:raise ValueError('unsupported WAV format'+str(fmt))
    if not 1600<=len(values)<=480000:raise ValueError('outside0.1..30seconds')
    return values.astype('<i2').tobytes(),len(values)
def acquire():
    for language,code in [('th','th_th'),('en','en_us')]:
        target_count=min(6,50-sum(id.startswith(language+':') for id in trained_ids)) if mode=='head-batch100' else 2
        if target_count<=0:continue
        progress('stream-'+language)
        table=sources/('SOURCE-2026-10-14T13-19-55-674Z-data_'+code+'_train.tsv')
        expected={'th':'cc10925ee1c45521ce8289cadb340329945b4580fdf020b747b78697877d0b43','en':'3ccfc83672cc03a835143e325abb38b4163e3a21725bc1a7d1165bc309b95852'}[language]
        if hashfile(table)!=expected:raise ValueError('source metadata hash')
        rows={}
        for line in table.read_text(encoding='utf8').splitlines():
            row=line.split('\t')
            if len(row)!=7:raise ValueError('TSV schema')
            if int(row[5])<=480000:rows[row[1]]=row
        url='https://huggingface.co/datasets/google/fleurs/resolve/'+revision+'/data/'+code+'/audio/train.tar.gz'
        got=0
        with urllib.request.urlopen(url,timeout=20) as response:
            budget=Budget(response)
            with tarfile.open(fileobj=budget,mode='r|gz') as archive:
                for member in archive:
                    name=pathlib.PurePosixPath(member.name).name
                    if not member.isfile() or name not in rows:continue
                    row=rows[name]
                    if language+':'+name in trained_ids:continue
                    if member.size>4000000:raise ValueError('member size budget')
                    try:pcm,frames=canonical(archive.extractfile(member).read(member.size))
                    except ValueError as e:report['failures'].append({'id':name,'reason':str(e)});continue
                    if frames!=int(row[5]):raise ValueError('published sample count mismatch')
                    digest=hashlib.sha256(pcm).hexdigest()
                    if digest in seen or digest in excluded_pcm:report['failures'].append({'id':name,'reason':'duplicate or development/held PCM'});continue
                    seen.add(digest);file=language+'-'+name
                    with wave.open(str(directory/file),'wb') as target:target.setparams((1,2,16000,frames,'NONE','not compressed'));target.writeframes(pcm)
                    manifest.append({'id':name,'sentence_id':row[0],'audio':file,'text':row[3],'raw_reference':row[2],'language':language,'source':'google/fleurs','revision':revision,'license':'CC-BY-4.0','publisher_split':'train','real_human':True,'synthetic':False,'speaker_id':None,'speaker_separation':'publisher-attested train/dev/test disjoint; no fabricated speaker identity','pcm_sha256':digest,'frames':frames,'archive_full_hash_verified':False,'streamed_member_only':True})
                    got+=1;report['newUniqueClips']=len(manifest);save()
                    if got==target_count:break
            report.setdefault('streamBytes',{})[language]=budget.count
        if got!=target_count:raise ValueError('insufficient source clips within streaming budget')
    (directory/'MANIFEST.jsonl').write_text(''.join(json.dumps(row,ensure_ascii=False)+'\n' for row in manifest),encoding='utf8')
    report['manifestSha256']=hashfile(directory/'MANIFEST.jsonl');report['languageCounts']={lang:sum(r['language']==lang for r in manifest) for lang in ['th','en']};report['uniquePCM']=len(seen)
def train():
    progress('load-frozen-source')
    import numpy as np,torch
    from transformers import Wav2Vec2Config,Wav2Vec2ForCTC
    from safetensors.torch import load_file,save_file
    torch.set_num_threads(3);torch.set_num_interop_threads(1);torch.manual_seed(20261014)
    source=root/'.tools'/'voice-models'/'wav2vec2-th-cv8-source-v1'
    metadata=json.loads((source/'SOURCE-MANIFEST.json').read_text(encoding='utf8'))
    if metadata['revision']!='18381b4cfbe8b2e7462827f2c6dea681a31ef5b9':raise ValueError('base revision')
    weights=source/'model.safetensors';entry=next(x for x in metadata['downloadedFiles'] if x['file']=='model.safetensors')
    if hashfile(weights)!=entry['sha256']:raise ValueError('base weight hash')
    config=Wav2Vec2Config.from_json_file(str(source/'config.json'));config._attn_implementation='eager'
    model=Wav2Vec2ForCTC(config);state=load_file(str(weights),device='cpu');model.load_state_dict(state,strict=True);del state;model.eval()
    for p in model.parameters():p.requires_grad_(False)
    vocab=json.loads((source/'vocab.json').read_text(encoding='utf8'));vocab.update({'<s>':70,'</s>':71})
    train_characters=set("abcdefghijklmnopqrstuvwxyz'0123456789")
    import unicodedata
    for code in ['th_th','en_us']:
        table=sources/('SOURCE-2026-10-14T13-19-55-674Z-data_'+code+'_train.tsv')
        for line in table.read_text(encoding='utf8').splitlines():train_characters.update(unicodedata.normalize('NFC',line.split('\t')[3]).lower().replace(' ','|'))
    for letter in sorted(train_characters):
        if letter not in vocab:vocab[letter]=len(vocab)
    if sorted(vocab.values())!=list(range(len(vocab))):raise ValueError('noncontinuous vocabulary')
    head=torch.nn.Linear(config.hidden_size,len(vocab));head.weight.data[:72].copy_(model.lm_head.weight);head.bias.data[:72].copy_(model.lm_head.bias)
    if previous:
        if previous['vocabSize']!=len(vocab) or previous['sourceWeightsSha256']!=entry['sha256']:raise ValueError('resume base/vocab mismatch')
        head.load_state_dict(load_file(str(prior/'head.safetensors')),strict=True)
    before=hashlib.sha256(head.weight.detach().numpy().tobytes()+head.bias.detach().numpy().tobytes()).hexdigest();optimizer=torch.optim.AdamW(head.parameters(),lr=0.0001,weight_decay=0.01)
    if previous and (prior/'optimizer.pt').exists():optimizer.load_state_dict(torch.load(prior/'optimizer.pt',map_location='cpu',weights_only=True));report['optimizerRestored']=True
    elif previous:report['optimizerRestored']=False;report['optimizerNote']='Initial four-clip pilot did not save optimizer; resume preserves learned head weights, new AdamW state is explicitly reset once.'
    report.update({'candidate':'cv8-frozen-body-bilingual-ctc-head-pilot-v1','sourceWeightsSha256':entry['sha256'],'beforeHeadSha256':before,'vocabSize':len(vocab),'trainableParameters':sum(p.numel() for p in head.parameters()),'frozenBody':True,'streamingArchitecture':False,'logs':[]})
    for row in manifest:
        progress('gradient-'+row['language']+'-'+row['id'])
        raw=row['text'].normalize('NFC') if hasattr(row['text'],'normalize') else row['text']
        import unicodedata
        text=unicodedata.normalize('NFC',raw).lower().replace(' ','|')
        missing=sorted(set(text)-set(vocab))
        if missing:report['failures'].append({'id':row['id'],'reason':'unrepresentable transcript','characters':missing});continue
        with wave.open(str(directory/row['audio']),'rb') as audio:values=np.frombuffer(audio.readframes(audio.getnframes()),dtype='<i2').astype(np.float32)/32768
        values=(values-values.mean())/np.sqrt(values.var()+1e-7);x=torch.from_numpy(values).unsqueeze(0)
        forward_started=time.monotonic()
        with torch.inference_mode():features=model.wav2vec2(x).last_hidden_state.clone()
        forward_ms=round((time.monotonic()-forward_started)*1000)
        features=features.clone();targets=torch.tensor([vocab[c] for c in text],dtype=torch.long)
        logits=head(features);log_probs=logits.log_softmax(-1).transpose(0,1)
        loss=torch.nn.functional.ctc_loss(log_probs,targets,torch.tensor([logits.shape[1]]),torch.tensor([len(targets)]),blank=69,reduction='mean',zero_infinity=False)
        if not torch.isfinite(loss):report['failures'].append({'id':row['id'],'reason':'nonfinite CTC loss'});continue
        optimizer.zero_grad();loss.backward();torch.nn.utils.clip_grad_norm_(head.parameters(),1.0);optimizer.step();report['trainingUpdates']+=1
        def decode(output):
            reverse={i:c for c,i in vocab.items()};last=None;letters=[]
            for token in output.argmax(-1).squeeze(0).tolist():
                if token!=last and token!=69 and token not in [68,70,71]:letters.append(reverse[token])
                last=token
            return ''.join(letters).replace('|',' ').strip()
        before_text=decode(logits.detach())
        with torch.no_grad():after_text=decode(head(features))
        trained_ids.add(row['language']+':'+row['id'])
        report['logs'].append({'id':row['id'],'language':row['language'],'reference':row['text'],'rawBefore':before_text,'rawAfter':after_text,'loss':float(loss.detach()),'frames':row['frames'],'frozenBodyForwardMs':forward_ms,'update':report['trainingUpdates'],'evaluationSplit':'training-only, not development/held','fullSpeechTiming':False});save()
    after=hashlib.sha256(head.weight.detach().numpy().tobytes()+head.bias.detach().numpy().tobytes()).hexdigest();report['afterHeadSha256']=after;report['headWeightsChanged']=before!=after
    save_file({k:v.detach().contiguous() for k,v in head.state_dict().items()},str(directory/'head.safetensors'));(directory/'vocab.json').write_text(json.dumps(vocab,ensure_ascii=False),encoding='utf8')
    torch.save(optimizer.state_dict(),directory/'optimizer.pt')
    report['checkpointSha256']=hashfile(directory/'head.safetensors');report['checkpointFile']='head.safetensors';report['trainedUniqueClips']=report['trainingUpdates'];report['hundredThousandComplete']=False;report['hundredClipTrainingComplete']=len(trained_ids)==100
    report['cumulativeTrainedUniqueClips']=len(trained_ids)
    pointer_data={'operationId':operation,'checkpointSha256':report['checkpointSha256'],'manifestSha256':report['manifestSha256'],'vocabSize':len(vocab),'sourceWeightsSha256':entry['sha256'],'trainedClipIds':sorted(trained_ids),'trainedPCMHashes':sorted(set(previous.get('trainedPCMHashes',[]) if previous else [])|seen),'optimizerSha256':hashfile(directory/'optimizer.pt'),'productionPromoted':False}
    temporary=pointer.with_suffix('.tmp-'+operation);temporary.write_text(json.dumps(pointer_data,ensure_ascii=False,indent=2),encoding='utf8');os.replace(temporary,pointer)
try:
    acquire()
    if mode in ['head-pilot','head-batch100']:train()
    report['state']='succeeded';progress('complete');print(json.dumps(report,ensure_ascii=False),flush=True)
except Exception as error:
    report['state']='failed';report['error']=str(error);save();print(json.dumps(report,ensure_ascii=False),flush=True);raise
