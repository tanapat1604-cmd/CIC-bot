# Experimental short-speech comparison only; production worker remains unchanged.
"""One local speech request per owned process; no microphone/file upload/cloud fallback."""
import base64,contextlib,ctypes,io,json,os,pathlib,sys,time,wave
from importlib.metadata import version
os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1'
def offline(event,args):
    if event in ('socket.connect','socket.getaddrinfo'):raise RuntimeError('network-disabled')
sys.addaudithook(offline)
started=time.monotonic()
timings={'importMs':0,'modelLoadMs':0,'decodeMs':0,'inputWaitMs':0}
def elapsed(at):return round((time.monotonic()-at)*1000)
def encoder_window(features,frames):
    import numpy as np
    if frames not in (600,3000) or features.ndim not in (2,3) or features.shape[-1]>3000:raise ValueError('invalid')
    return np.ascontiguousarray(features[..., :frames])

def load_asr(model):
    at=time.monotonic()
    import numpy
    if version('faster-whisper')!='1.2.1':raise ValueError('invalid')
    from faster_whisper import WhisperModel
    timings['importMs']+=elapsed(at);at=time.monotonic()
    cpu_threads=int(os.environ.get('CIC_ASR_CPU_THREADS','3'))
    if cpu_threads not in (2,3,4):raise ValueError('invalid')
    class WindowWhisperModel(WhisperModel):
        encoder_frames=3000
        def encode(self,features):return super().encode(encoder_window(features,self.encoder_frames))
    loaded=WindowWhisperModel(str(model),device='cpu',compute_type='int8',cpu_threads=cpu_threads,num_workers=1,local_files_only=True)
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
    if version('faster-whisper')!='1.2.1' or not ({'kind','pcm'}<=set(request)<={'kind','pcm','language','context','decodeProfile','minimumActivityMs'}) or request.get('language','th') not in ('th','auto') or request.get('context','none') not in ('none','apps') or request.get('decodeProfile','legacy') not in ('legacy','thai-command-v1','thai-window6-v1'):raise ValueError('invalid')
    pcm=base64.b64decode(request['pcm'],validate=True)
    if not 8000<=len(pcm)<=480000 or len(pcm)%2:raise ValueError('invalid-audio')
    audio=np.frombuffer(pcm,dtype='<i2').astype(np.float32)/32768
    if not has_signal(audio,request.get('minimumActivityMs',250)):raise ValueError('no-speech')
    whisper=prepared if prepared is not None else load_asr(model)
    decode_started=time.monotonic()
    profile=request.get('decodeProfile','legacy')
    if profile=='thai-window6-v1' and request.get('context','none')!='none':raise ValueError('invalid')
    whisper.encoder_frames=600 if profile=='thai-window6-v1' and len(audio)<=80000 else 3000
    bounded=profile in ('thai-command-v1','thai-window6-v1')
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
