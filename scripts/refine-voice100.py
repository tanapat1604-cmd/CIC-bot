"""One preregistered optimization-budget experiment on the SAME100 train clips.
Cache frozen-body features in bounded owned batches; then20 additional epochs.
No dev/held samples, new source download, production promotion or microphone.
"""
import os,sys,pathlib,json,uuid,time,hashlib,wave,unicodedata,random
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',OMP_NUM_THREADS='3',OPENBLAS_NUM_THREADS='3')
root=pathlib.Path(__file__).resolve().parents[1];operation,mode=sys.argv[1:];uuid.UUID(operation)
if mode not in ['head-cache100','head-refine100']:raise ValueError('mode')
run=root/'.tools/voice-training'/operation;run.mkdir(exist_ok=False)
cache=root/'.tools/voice-training/frozen-features100-v1';cache.mkdir(exist_ok=True)
started=time.monotonic();report={'version':1,'operationId':operation,'mode':mode,'newUniqueClips':0,'trainingUpdates':0,'productionModified':False,'fullSpeechAccepted':False,'fixedUniqueTrainingClips':100,'newPublicAudioDownloaded':False}
def sha(file):
    h=hashlib.sha256()
    with open(file,'rb') as f:
        for b in iter(lambda:f.read(1048576),b''):h.update(b)
    return h.hexdigest()
def save():
    report['elapsedMs']=round((time.monotonic()-started)*1000);(run/'PROGRESS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
try:
    import numpy as np,torch
    from safetensors.torch import load_file,save_file
    torch.set_num_threads(3);torch.set_num_interop_threads(1);torch.manual_seed(20261016)
    pointer=json.loads((root/'.tools/voice-training/CANDIDATE-PILOT-CURRENT.json').read_text(encoding='utf8'))
    if pointer['operationId']!='d58b3726-7230-494d-8b56-ad12ad992dc6' or len(pointer['trainedClipIds'])!=100:raise ValueError('fixed100 checkpoint')
    rows=[];op=pointer['operationId']
    while op:
        parent=root/'.tools/voice-training'/op;p=json.loads((parent/'PROGRESS.json').read_text(encoding='utf8'));trained={r['id'] for r in p['logs']}
        for line in (parent/'MANIFEST.jsonl').read_text(encoding='utf8').splitlines():
            row=json.loads(line)
            if row['id'] in trained:row['file']=str(parent/row['audio']);rows.append(row)
        op=p.get('resumedFromOperation')
    rows.sort(key=lambda r:r['language']+':'+r['id'])
    if len(rows)!=100 or len({r['pcm_sha256'] for r in rows})!=100 or {r['language']+':'+r['id'] for r in rows}!=set(pointer['trainedClipIds']):raise ValueError('fixed100 identity')
    dataset_sha=hashlib.sha256(json.dumps([{k:r[k] for k in ['id','language','pcm_sha256','text']} for r in rows],ensure_ascii=False,sort_keys=True).encode()).hexdigest()
    (run/'MANIFEST.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows),encoding='utf8')
    report.update(sourceCheckpoint=pointer['operationId'],datasetSha256=dataset_sha,sourceWeightsSha256=pointer['sourceWeightsSha256'],manifestSha256=sha(run/'MANIFEST.jsonl'))
    def paths(r):return cache/(r['pcm_sha256']+'.safetensors'),cache/(r['pcm_sha256']+'.json')
    def verified(r):
        file,meta=paths(r)
        if not meta.exists():return False
        value=json.loads(meta.read_text(encoding='utf8'))
        if value['pcmSha256']!=r['pcm_sha256'] or value['datasetSha256']!=dataset_sha or value['sourceWeightsSha256']!=pointer['sourceWeightsSha256'] or value['featureSha256']!=sha(file):raise ValueError('cache integrity')
        return True
    if mode=='head-cache100':
        missing=[r for r in rows if not verified(r)][:12]
        if not missing:report['newCachedFeatures']=0
        else:
            from transformers import Wav2Vec2Config,Wav2Vec2ForCTC
            source=root/'.tools/voice-models/wav2vec2-th-cv8-source-v1'
            if sha(source/'model.safetensors')!=pointer['sourceWeightsSha256']:raise ValueError('base integrity')
            cfg=Wav2Vec2Config.from_json_file(str(source/'config.json'));cfg._attn_implementation='eager';model=Wav2Vec2ForCTC(cfg)
            state=load_file(str(source/'model.safetensors'));model.load_state_dict(state,strict=True);del state;model.eval();report['logs']=[]
            for r in missing:
                with wave.open(r['file'],'rb') as a:
                    if (a.getnchannels(),a.getsampwidth(),a.getframerate())!=(1,2,16000):raise ValueError('audio format')
                    pcm=a.readframes(a.getnframes())
                if hashlib.sha256(pcm).hexdigest()!=r['pcm_sha256']:raise ValueError('training PCM changed')
                values=np.frombuffer(pcm,dtype='<i2').astype(np.float32)/32768;values=(values-values.mean())/np.sqrt(values.var()+1e-7);began=time.monotonic()
                with torch.inference_mode():features=model.wav2vec2(torch.from_numpy(values).unsqueeze(0)).last_hidden_state.contiguous()
                file,meta=paths(r);temporary=run/(r['pcm_sha256']+'.features.tmp');save_file({'features':features},str(temporary));os.replace(temporary,file)
                item={'id':r['id'],'language':r['language'],'pcmSha256':r['pcm_sha256'],'datasetSha256':dataset_sha,'sourceWeightsSha256':pointer['sourceWeightsSha256'],'featureSha256':sha(file),'frames':features.shape[1],'forwardMs':round((time.monotonic()-began)*1000)}
                meta.write_text(json.dumps(item),encoding='utf8');report['logs'].append(item);save()
                if sum(p.stat().st_size for p in cache.iterdir())>1073741824:raise ValueError('cache1GiB budget')
            report['newCachedFeatures']=len(missing)
        report['cachedFeaturesTotal']=sum(verified(r) for r in rows)
    else:
        if not all(verified(r) for r in rows):raise ValueError('100features required')
        base=root/'.tools/voice-training'/pointer['operationId']
        if sha(base/'head.safetensors')!=pointer['checkpointSha256'] or sha(base/'optimizer.pt')!=pointer['optimizerSha256']:raise ValueError('resume integrity')
        vocab=json.loads((base/'vocab.json').read_text(encoding='utf8'));head=torch.nn.Linear(1024,len(vocab));head.load_state_dict(load_file(str(base/'head.safetensors')),strict=True)
        optimizer=torch.optim.AdamW(head.parameters(),lr=0.0001,weight_decay=0.01);optimizer.load_state_dict(torch.load(base/'optimizer.pt',map_location='cpu',weights_only=True))
        if any(g['lr']!=0.0001 for g in optimizer.param_groups):raise ValueError('fixed learning rate')
        reverse={i:c for c,i in vocab.items()};examples=[]
        for r in rows:
            text=unicodedata.normalize('NFC',r['text']).lower().replace(' ','|');targets=torch.tensor([vocab[c] for c in text],dtype=torch.long);features=load_file(str(paths(r)[0]))['features'];examples.append((r,features,targets))
        rng=random.Random(20261016);report.update(epochs=20,learningRate=0.0001,frozenBody=True,headWeightsChanged=False,epochMetrics=[])
        for epoch in range(20):
            indexes=list(range(100));rng.shuffle(indexes);losses=[]
            for i in indexes:
                r,features,targets=examples[i];logits=head(features);loss=torch.nn.functional.ctc_loss(logits.log_softmax(-1).transpose(0,1),targets,torch.tensor([logits.shape[1]]),torch.tensor([len(targets)]),blank=69,reduction='mean',zero_infinity=False)
                if not torch.isfinite(loss):raise ValueError('nonfinite loss')
                optimizer.zero_grad();loss.backward();torch.nn.utils.clip_grad_norm_(head.parameters(),1.0);optimizer.step();report['trainingUpdates']+=1;losses.append(float(loss.detach()))
            report['epochMetrics'].append({'epoch':epoch+1,'meanTrainingLoss':sum(losses)/100,'notValidationAccuracy':True});save();print('epoch:'+str(epoch+1),file=sys.stderr,flush=True)
        report['trainingSetFinalRaw']=[]
        for r,features,_targets in examples:
            with torch.inference_mode():tokens=head(features).argmax(-1).squeeze(0).tolist()
            emitted=[];last=None
            for token in tokens:
                if token!=last and token!=69:emitted.append(reverse[token])
                last=token
            report['trainingSetFinalRaw'].append({'id':r['id'],'language':r['language'],'reference':r['text'],'rawText':''.join(emitted).replace('|',' ').strip(),'validation':False})
        save_file({k:v.detach().contiguous() for k,v in head.state_dict().items()},str(run/'head.safetensors'));torch.save(optimizer.state_dict(),run/'optimizer.pt');(run/'vocab.json').write_text(json.dumps(vocab,ensure_ascii=False),encoding='utf8')
        report['checkpointSha256']=sha(run/'head.safetensors');report['headWeightsChanged']=report['checkpointSha256']!=pointer['checkpointSha256'];report['optimizerSha256']=sha(run/'optimizer.pt')
        refined={**pointer,'operationId':operation,'checkpointSha256':report['checkpointSha256'],'optimizerSha256':report['optimizerSha256'],'manifestSha256':report['manifestSha256'],'refinedFromOperation':pointer['operationId'],'uniqueHumanClips':100,'additionalEpochs':20,'additionalOptimizationSteps':report['trainingUpdates'],'productionPromoted':False}
        (root/'.tools/voice-training/REFINED-100-CURRENT.json').write_text(json.dumps(refined,indent=2),encoding='utf8')
    report['state']='succeeded';save();print(json.dumps(report,ensure_ascii=False),flush=True)
except Exception as error:
    report.update(state='failed',error=str(error));save();print(json.dumps(report,ensure_ascii=False),flush=True);raise
