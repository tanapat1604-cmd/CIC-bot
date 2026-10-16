# Experimental Thai CTC comparison only; production worker remains unchanged.
"""One local speech request per owned process; no microphone/file upload/cloud fallback."""
import base64,contextlib,ctypes,io,json,os,pathlib,sys,time,wave
from importlib.metadata import version
os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1'
def offline(event,args):
    if event in ('socket.connect','socket.getaddrinfo'):raise RuntimeError('network-disabled')
sys.addaudithook(offline)
sys.path.append('C:/Users/This PC/.codex/.chatgpt-projects/g-p-6ab9187262b881919cc7a1cf9af4966b/.tools/voice-runtime/Lib/site-packages')
started=time.monotonic()
timings={'importMs':0,'modelLoadMs':0,'decodeMs':0,'inputWaitMs':0}
def elapsed(at):return round((time.monotonic()-at)*1000)

def cv8_tokenizer(model):
    vocab=json.loads((model/'vocab.json').read_text(encoding='utf-8'))
    added=json.loads((model/'added_tokens.json').read_text(encoding='utf-8'))
    special=json.loads((model/'special_tokens_map.json').read_text(encoding='utf-8'))
    tokenizer=json.loads((model/'tokenizer_config.json').read_text(encoding='utf-8'))
    config=json.loads((model/'config.json').read_text(encoding='utf-8'))
    if len(vocab)!=70 or added!={'<s>':70,'</s>':71}:raise ValueError('invalid-tokenizer')
    merged=dict(vocab)
    for token,value in added.items():
        if token in merged and merged[token]!=value:raise ValueError('invalid-tokenizer')
        merged[token]=value
    if any(type(value) is not int for value in merged.values()) or sorted(merged.values())!=list(range(72)):raise ValueError('invalid-tokenizer')
    expected={'bos_token':'<s>','eos_token':'</s>','unk_token':'[UNK]','pad_token':'[PAD]'}
    if any(special.get(key)!=value or tokenizer.get(key)!=value for key,value in expected.items()):raise ValueError('invalid-tokenizer')
    extras=special.get('additional_special_tokens',[])
    if {entry.get('content') if isinstance(entry,dict) else entry for entry in extras}!={'<s>','</s>'}:raise ValueError('invalid-tokenizer')
    if config.get('vocab_size')!=72 or config.get('pad_token_id')!=merged['[PAD]'] or merged['[PAD]']!=69 or merged['[UNK]']!=68:raise ValueError('invalid-tokenizer')
    if tokenizer.get('do_lower_case') is not False or tokenizer.get('word_delimiter_token')!='|' or tokenizer.get('replace_word_delimiter_char')!=' ':raise ValueError('invalid-tokenizer')
    # config bos/eos IDs 1/2 are generic architecture defaults, NOT tokenizer IDs.
    # No publisher LM is loaded. Raw CTC collapse retains blank boundaries;
    # emitted UNK/BOS/EOS are refused, never hidden or mapped into a command.
    return {value:key for key,value in merged.items()}

def load_asr(model):
    if free_memory_mib()<8192:raise ValueError('model-memory-budget')
    at=time.monotonic()
    import numpy
    if (model/'model-int8.onnx').is_file():
        import onnxruntime as ort
        if version('onnxruntime')!='1.30.0':raise ValueError('invalid')
        threads=int(os.environ.get('CIC_ASR_CPU_THREADS','3'))
        if threads not in (2,3,4):raise ValueError('invalid')
        options=ort.SessionOptions();options.intra_op_num_threads=threads;options.inter_op_num_threads=1
        vocab=json.loads((model/'vocab.json').read_text(encoding='utf-8'))
        config=json.loads((model/'config.json').read_text(encoding='utf-8'))
        preprocessor=json.loads((model/'preprocessor_config.json').read_text(encoding='utf-8'))
        if preprocessor.get('sampling_rate')!=16000 or preprocessor.get('do_normalize') is not True or config.get('pad_token_id')!=vocab.get('[PAD]'):raise ValueError('invalid')
        timings['importMs']+=elapsed(at);at=time.monotonic()
        session=ort.InferenceSession(str(model/'model-int8.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
        timings['modelLoadMs']+=elapsed(at)
        return {'session':session,'tokens':cv8_tokenizer(model),'blank':vocab['[PAD]']}
    if version('faster-whisper')!='1.2.1':raise ValueError('invalid')
    from faster_whisper import WhisperModel
    timings['importMs']+=elapsed(at);at=time.monotonic()
    cpu_threads=int(os.environ.get('CIC_ASR_CPU_THREADS','3'))
    if cpu_threads not in (2,3,4):raise ValueError('invalid')
    loaded=WhisperModel(str(model),device='cpu',compute_type='int8',cpu_threads=cpu_threads,num_workers=1,local_files_only=True)
    timings['modelLoadMs']+=elapsed(at)
    return loaded
PHRASES={'sample':'สวัสดีครับ ผมซีไอซี ได้ครับท่าน พร้อมช่วยเปิดเพลงครับ','ack':'ได้ครับท่าน กำลังหาเพลงล่าสุดให้ครับ','opened':'เปิดให้แล้วครับท่าน','failed':'ยังทำไม่สำเร็จครับท่าน กรุณาตรวจข้อความบนหน้าจอ','artist':'ขอชื่อศิลปินให้ชัดอีกครั้งครับท่าน','stopped':'หยุดแล้วครับท่าน','notepadOpened':'เปิดสมุดบันทึกใหม่และตรวจหน้าต่างแล้วครับท่าน','chromeOpened':'เปิดโครมหน้าต่างใหม่และตรวจแล้วครับท่าน','youtubeOpened':'เปิดหน้าเว็บไซต์ยูทูบและตรวจแล้วครับท่าน ยังไม่ได้เล่นคลิป','musicOpened':'ตรวจแล้วว่าเพลงหลักกำลังเล่นครับท่าน','chromeRequested':'ส่งคำขอเปิดโครมแล้วครับ','youtubeRequested':'ส่งคำขอเปิดยูทูบแล้วครับ','clarify':'ยังไม่เข้าใจครับ'}
def memory():
    if sys.platform!='win32':return None
    class Counters(ctypes.Structure):
        _fields_=[('cb',ctypes.c_ulong),('PageFaultCount',ctypes.c_ulong)]+[(n,ctypes.c_size_t)for n in ['PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage','PrivateUsage']]
    c=Counters();c.cb=ctypes.sizeof(c)
    ctypes.windll.kernel32.GetCurrentProcess.restype=ctypes.c_void_p
    f=ctypes.windll.psapi.GetProcessMemoryInfo;f.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_ulong]
    if not f(ctypes.windll.kernel32.GetCurrentProcess(),ctypes.byref(c),c.cb):return None
    return round(c.PeakWorkingSetSize/1048576,2)
def has_signal(audio,minimum_ms=250):
    if minimum_ms not in (180,250):raise ValueError('invalid')
    # Match capture's 20 ms RMS frames and 250 ms minimum activity. Padding and
    # internal pauses must not dilute speech. This gate does not certify speech.
    import numpy as np
    active=0
    for offset in range(0,len(audio),320):
        frame=audio[offset:offset+320]
        if len(frame) and float(np.sqrt(np.mean(frame*frame)))>=0.007:active+=len(frame)
    return active>=minimum_ms*16

def acoustic_nbest(logits,blank,width=32):
    import math,numpy as np
    def plus(a,b):
        if a==-math.inf:return b
        if b==-math.inf:return a
        high=max(a,b);return high+math.log1p(math.exp(min(a,b)-high))
    scores=logits-logits.max(axis=-1,keepdims=True)
    scores-=np.log(np.exp(scores).sum(axis=-1,keepdims=True))
    beams={(): (0.0,-math.inf)}
    for frame in scores:
        selected=set(np.argsort(frame)[-8:].tolist());selected.add(blank)
        next_beams={}
        def add(prefix,b=-math.inf,n=-math.inf):
            old_b,old_n=next_beams.get(prefix,(-math.inf,-math.inf))
            next_beams[prefix]=(plus(old_b,b),plus(old_n,n))
        for prefix,(pb,pn) in beams.items():
            total=plus(pb,pn)
            for token in selected:
                p=float(frame[token])
                if token==blank:add(prefix,b=total+p)
                elif prefix and token==prefix[-1]:
                    add(prefix,n=pn+p)
                    add(prefix+(token,),n=pb+p)
                else:add(prefix+(token,),n=total+p)
        beams=dict(sorted(next_beams.items(),key=lambda item:plus(*item[1]),reverse=True)[:width])
    return [(key,plus(*value)) for key,value in sorted(beams.items(),key=lambda item:plus(*item[1]),reverse=True) if plus(*value)!=-math.inf]



def free_memory_mib():
    class Status(ctypes.Structure):
        _fields_=[('length',ctypes.c_ulong),('load',ctypes.c_ulong)]+[(name,ctypes.c_ulonglong) for name in ['physical','available','page','availablePage','virtual','availableVirtual','extended']]
    status=Status();status.length=ctypes.sizeof(status)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):raise ValueError('memory-unverified')
    return status.available/1048576

def float_diagnostic(normalized,tokens,pcm,int8_logits,prepared):
    import hashlib,gc,threading
    allowed={'d491f0d63af55702b6685d447f2f92b43d58b79681f1a611892845b68264f2c5':'control-5','4f36bbebaf2de62a7613f828b9c46addb5fc08e6b02297b1c22ce78787062014':'gowajee-4'}
    digest=hashlib.sha256(pcm).hexdigest()
    if digest not in allowed:raise ValueError('diagnostic-public-audio-only')
    # Release ORT before Torch to avoid two resident models. Same owned process.
    del prepared['session'];gc.collect()
    finished=threading.Event()
    def watchdog():
        while not finished.wait(.25):
            if free_memory_mib()<2048 or memory()>6144:
                print(json.dumps({'version':1,'ok':False,'code':'model-memory-budget','timings':timings}),flush=True);os._exit(1)
    thread=threading.Thread(target=watchdog,daemon=True);thread.start()
    at=time.monotonic()
    try:
        import torch
        from transformers import Wav2Vec2ForCTC
        torch.set_num_threads(3);torch.set_num_interop_threads(1)
        source=pathlib.Path(__file__).resolve().parents[2]/'.tools'/'voice-models'/'wav2vec2-th-cv8-source-v1'
        manifest=json.loads((source/'SOURCE-MANIFEST.json').read_text(encoding='utf-8'))
        if manifest.get('revision')!='18381b4cfbe8b2e7462827f2c6dea681a31ef5b9':raise ValueError('revision-mismatch')
        model=Wav2Vec2ForCTC.from_pretrained(source,local_files_only=True,use_safetensors=True).eval()
        loaded_ms=elapsed(at);decode_at=time.monotonic()
        with torch.inference_mode():logits=model(torch.from_numpy(normalized[None,:])).logits.numpy()[0]
        inference_ms=elapsed(decode_at)
        def raw(values):
            pieces=[];previous=None
            for value in values.argmax(axis=-1):
                value=int(value)
                if value!=previous and value!=69:pieces.append(tokens[value])
                previous=value
            return ''.join(pieces).replace('|',' ').strip()
        try:accepted=decode_ctc(logits,tokens,69);refusal=None
        except ValueError as error:accepted=None;refusal=str(error)
        diagnostic={'publicClipId':allowed[digest],'pcmSha256':digest,'sourceRevision':manifest['revision'],'originalFloatRaw':raw(logits),'originalFloatGuardedText':accepted,'originalFloatRefusal':refusal,'int8Raw':raw(int8_logits),'floatLoadImportMs':loaded_ms,'floatInferenceMs':inference_ms,'originalFloatLogitsShape':list(logits.shape),'int8LogitsShape':list(int8_logits.shape),'logitsMeanAbsoluteDifference':float(abs(logits-int8_logits).mean()),'peakMiB':memory(),'publisherLM':False,'originalSamplesUnchanged':True,'neverUsedForCommand':True,'resourceGuards':{'minimumFreeMiB':2048,'maximumPeakMiB':6144,'sampleMs':250}}
        target=pathlib.Path(__file__).resolve().parents[2]/'validation'/'2026-10-14-cv8-float-diagnostic'
        with (target/(allowed[digest]+'-float.json')).open('x',encoding='utf-8') as out:json.dump(diagnostic,out,ensure_ascii=False,indent=2)
        del model;gc.collect()
    finally:finished.set();thread.join(timeout=1)

def public_acoustic_diagnostic(logits,tokens,pcm):
    import hashlib
    allowed={"eb65bc144000652d720726a5b0f032f959ad2f4a845eb8a491556554ccafc9d0":"control-2","b601c60765ca81ce6aa2a2949ea2c27d6884efafd813be037b80f0259872639d":"control-4","d491f0d63af55702b6685d447f2f92b43d58b79681f1a611892845b68264f2c5":"control-5","4f36bbebaf2de62a7613f828b9c46addb5fc08e6b02297b1c22ce78787062014":"gowajee-4"}
    digest=hashlib.sha256(pcm).hexdigest()
    if digest not in allowed:raise ValueError('diagnostic-public-audio-only')
    rows=[]
    for ids,score in acoustic_nbest(logits,69):
        rows.append({'tokenIds':list(ids),'text':''.join(tokens[value] for value in ids).replace('|',' ').strip(),'acousticLogScore':score,'specialTokenPresent':any(value in (68,70,71) for value in ids)})
    target=pathlib.Path(__file__).resolve().parents[2]/'validation'/'2026-10-14-cv8-acoustic'
    target.mkdir(exist_ok=True)
    value={'at':time.time(),'publicClipId':allowed[digest],'pcmSha256':digest,'topPaths':rows,'greedyIds':[int(value) for value in logits.argmax(axis=-1)],'classes':int(logits.shape[1]),'publisherLM':False,'neverUsedForCommand':True}
    with (target/(allowed[digest]+'-acoustic.json')).open('x',encoding='utf-8') as out:json.dump(value,out,ensure_ascii=False,indent=2)

def decode_ctc(logits,tokens,blank):
    import numpy as np,zlib
    if logits.ndim!=2 or logits.shape[1]!=72 or set(tokens)!=set(range(72)) or not np.isfinite(logits).all():raise ValueError('uncertain-speech')
    ids=logits.argmax(axis=-1);active=ids!=blank
    if not active.any():raise ValueError('no-speech')
    scores=logits-logits.max(axis=-1,keepdims=True)
    probabilities=np.exp(scores);probabilities/=probabilities.sum(axis=-1,keepdims=True)
    if float(probabilities[active].max(axis=-1).mean())<0.75:raise ValueError('uncertain-speech')
    pieces=[];previous=None
    for value in ids:
        value=int(value)
        if value!=previous and value!=blank:pieces.append(tokens.get(value,'[UNK]'))
        previous=value
    if any(piece in ('[UNK]','<s>','</s>') for piece in pieces):raise ValueError('uncertain-speech')
    text=''.join(pieces).replace('|',' ').strip()
    if not text:raise ValueError('no-speech')
    if len(text)>200:raise ValueError('transcript-limit')
    encoded=text.encode('utf-8')
    if any(ord(c)<32 for c in text) or len(encoded)/len(zlib.compress(encoded))>2.4:raise ValueError('uncertain-speech')
    return text

def run(request,model,prepared=None):
    at=time.monotonic()
    import numpy as np
    timings['importMs']+=elapsed(at)
    if request['kind']=='tts':
        if version('piper-tts')!='1.8.0' or set(request)!={'kind','phrase'} or request['phrase'] not in PHRASES:raise ValueError('invalid')
        import onnxruntime as ort
        from piper import PiperVoice
        from piper.config import PiperConfig
        config=PiperConfig.from_dict(json.loads(pathlib.Path(str(model)+'.json').read_text(encoding='utf-8')))
        options=ort.SessionOptions();options.intra_op_num_threads=3;options.inter_op_num_threads=1
        voice=PiperVoice(config=config,session=ort.InferenceSession(str(model),sess_options=options,providers=['CPUExecutionProvider']),download_dir=model.parent)
        audio=io.BytesIO()
        with wave.open(audio,'wb') as out:voice.synthesize_wav(PHRASES[request['phrase']],out)
        data=audio.getvalue()
        if len(data)>2_000_000:raise ValueError('audio-limit')
        return {'kind':'tts','phrase':request['phrase'],'wav':base64.b64encode(data).decode('ascii'),'audioBytes':len(data)}
    if version('faster-whisper')!='1.2.1' or not ({'kind','pcm'}<=set(request)<={'kind','pcm','language','context','decodeProfile','minimumActivityMs'}) or request.get('language','th') not in ('th','auto') or request.get('context','none') not in ('none','apps') or request.get('decodeProfile','legacy') not in ('legacy','thai-command-v1','ctc-greedy-v1'):raise ValueError('invalid')
    pcm=base64.b64decode(request['pcm'],validate=True)
    if not 8000<=len(pcm)<=480000 or len(pcm)%2:raise ValueError('invalid-audio')
    audio=np.frombuffer(pcm,dtype='<i2').astype(np.float32)/32768
    if not has_signal(audio,request.get('minimumActivityMs',250)):raise ValueError('no-speech')
    whisper=prepared if prepared is not None else load_asr(model)
    decode_started=time.monotonic()
    if isinstance(whisper,dict):
        if request.get('decodeProfile')!='ctc-greedy-v1' or request.get('language','th')!='th' or request.get('context','none')!='none':raise ValueError('invalid')
        from faster_whisper.vad import get_speech_timestamps,VadOptions
        if not get_speech_timestamps(audio,VadOptions(min_silence_duration_ms=500)):raise ValueError('no-speech')
        normalized=(audio-audio.mean())/np.sqrt(audio.var()+1e-7)
        logits=whisper['session'].run(None,{'input_values':normalized[None,:]})[0][0]
        float_diagnostic(normalized,whisper['tokens'],pcm,logits,whisper)
        text=decode_ctc(logits,whisper['tokens'],whisper['blank'])
        timings['decodeMs']=elapsed(decode_started)
        return {'kind':'asr','text':text,'language':'th','clipMs':round(len(audio)/16)}
    if request.get('decodeProfile')=='ctc-greedy-v1':raise ValueError('invalid')
    bounded=request.get('decodeProfile','legacy')=='thai-command-v1'
    segments,info=whisper.transcribe(audio,language=None if request.get('language','th')=='auto' else 'th',beam_size=1 if bounded else 5,without_timestamps=bounded,**({'temperature':0.0} if bounded else {}),initial_prompt='Notepad, Chrome, YouTube, CiC, โน้ตแพด, โครม, ยูทูบ.' if request.get('context')=='apps' else None,vad_filter=True,vad_parameters={'min_silence_duration_ms':500},condition_on_previous_text=False,compression_ratio_threshold=2.0)
    pieces=list(segments)
    timings['decodeMs']=elapsed(decode_started)
    if info.language not in ('th','en'):raise ValueError('uncertain-speech')
    text=''.join(s.text for s in pieces).strip()
    if not pieces or sum(s.avg_logprob for s in pieces)/len(pieces)<-1.0:raise ValueError('uncertain-speech')
    # A bounded decode refuses repetition; it never repairs or approves raw text.
    # Use the library's standard 2.4 cutoff: normal UTF-8 Thai can exceed 2.0.
    if bounded and any(s.compression_ratio>2.4 for s in pieces):raise ValueError('uncertain-speech')
    if not text:raise ValueError('no-speech')
    if len(text)>200:raise ValueError('transcript-limit')
    return {'kind':'asr','text':text,'language':info.language,'clipMs':round(len(audio)/16)}
try:
    model=pathlib.Path(sys.argv[1]).resolve();prepared=None
    if len(sys.argv)>2:
        if sys.argv[2:]!=['--prepare']:raise ValueError('invalid')
        with contextlib.redirect_stdout(sys.stderr):prepared=load_asr(model)
        print(json.dumps({'version':1,'ready':True,'timings':timings}),flush=True)
    waiting=time.monotonic()
    raw=sys.stdin.buffer.read(700001)
    timings['inputWaitMs']=elapsed(waiting)
    if len(raw)>700000:raise ValueError('input-limit')
    request=json.loads(raw);model=pathlib.Path(sys.argv[1]).resolve()
    if request.get('kind') not in ('asr','tts'):raise ValueError('invalid')
    if prepared is not None and request.get('kind')!='asr':raise ValueError('invalid')
    with contextlib.redirect_stdout(sys.stderr):result=run(request,model,prepared)
    print(json.dumps({'version':1,'ok':True,**result,'elapsedMs':round((time.monotonic()-started)*1000),'peakWorkingSetMiB':memory(),'timings':timings},ensure_ascii=False))
except Exception as error:
    if os.environ.get('CIC_VOICE_DEBUG')=='1':
        import traceback
        traceback.print_exc(file=sys.stderr)
    print(json.dumps({'version':1,'ok':False,'code':str(error) if isinstance(error,ValueError) else 'runtime-failed','exception':type(error).__name__,'timings':timings},ensure_ascii=False));sys.exit(1)
