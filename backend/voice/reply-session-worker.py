"""One owner-bound warm Piper session. No microphone, network, or reply cache."""
import base64, contextlib, ctypes, io, json, os, pathlib, re, sys, time, wave
from importlib.metadata import version
os.environ['HF_HUB_OFFLINE']='1'; os.environ['TRANSFORMERS_OFFLINE']='1'
def offline(event,args):
    if event in ('socket.connect','socket.getaddrinfo'):
        raise RuntimeError('network-disabled')
sys.addaudithook(offline)
started=time.monotonic()
def elapsed(at): return round((time.monotonic()-at)*1000)
def read():
    raw=sys.stdin.buffer.readline(8193)
    if not raw: return None
    if len(raw)>8192 or not raw.endswith(b'\n'): raise ValueError('input-limit')
    return json.loads(raw)
def memory():
    if sys.platform!='win32': return None
    class Counters(ctypes.Structure):
        _fields_=[('cb',ctypes.c_ulong),('PageFaultCount',ctypes.c_ulong)]+[(n,ctypes.c_size_t)for n in ['PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage','PrivateUsage']]
    c=Counters(); c.cb=ctypes.sizeof(c)
    ctypes.windll.kernel32.GetCurrentProcess.restype=ctypes.c_void_p
    f=ctypes.windll.psapi.GetProcessMemoryInfo; f.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_ulong]
    return round(c.PeakWorkingSetSize/1048576,2) if f(ctypes.windll.kernel32.GetCurrentProcess(),ctypes.byref(c),c.cb) else None
try:
    if len(sys.argv)!=2: raise ValueError('invalid')
    initial=read()
    if not isinstance(initial,dict) or set(initial)!={'kind','leaseId'} or initial['kind']!='init' or not re.fullmatch(r'[0-9a-f-]{36}',str(initial['leaseId'])): raise ValueError('invalid')
    lease=initial['leaseId']; del initial
    model=pathlib.Path(sys.argv[1]).resolve()
    if version('piper-tts')!='1.8.0': raise ValueError('invalid')
    with contextlib.redirect_stdout(sys.stderr):
        at=time.monotonic()
        import onnxruntime as ort
        from piper import PiperVoice
        from piper.config import PiperConfig
        import_ms=elapsed(at); at=time.monotonic()
        config=PiperConfig.from_dict(json.loads(pathlib.Path(str(model)+'.json').read_text(encoding='utf-8')))
        options=ort.SessionOptions(); options.intra_op_num_threads=3; options.inter_op_num_threads=1
        voice=PiperVoice(config=config,session=ort.InferenceSession(str(model),sess_options=options,providers=['CPUExecutionProvider']),download_dir=model.parent)
        load_ms=elapsed(at); at=time.monotonic()
        voice.phonemize('พร้อมฟังครับ')
        phonemizer_ms=elapsed(at)
    print(json.dumps({'version':1,'ready':True,'leaseId':lease,'timings':{'importMs':import_ms,'modelLoadMs':load_ms,'decodeMs':phonemizer_ms,'inputWaitMs':0}}),flush=True)
    seen=set()
    while True:
        request=read()
        if request is None: break
        op=request.get('operationId'); text=request.get('text')
        if set(request)!={'kind','operationId','text'} or request['kind']!='tts' or not re.fullmatch(r'[0-9a-f-]{36}',str(op)) or op in seen or len(seen)>=128 or not isinstance(text,str) or not 1<=len(text)<=600 or text!=text.strip() or any(ord(c)<32 or 127<=ord(c)<=159 for c in text): raise ValueError('invalid-audio')
        seen.add(op); at=time.monotonic()
        # The installed Thai phonemizer drops Latin. Refuse mixed replies until
        # a separately validated mixed-language path exists; never emit partial
        # speech as if it contained the whole answer.
        if re.search(r'[A-Za-z]',text):
            print(json.dumps({'version':1,'ok':False,'operationId':op,'code':'reply-language-unsupported'}),flush=True)
            del request,text
            continue
        rendered=text
        if re.fullmatch(r'[\d\s.+\-*/()]+\s*=\s*-?[\d.]+',text):
            words={'+':' บวก ','-':' ลบ ','*':' คูณ ','/':' หาร ','=':' เท่ากับ ','.':' จุด ','(':' เปิดวงเล็บ ',')':' ปิดวงเล็บ '}
            rendered=''.join(words.get(c,c) for c in text)
        with contextlib.redirect_stdout(sys.stderr):
            audio=io.BytesIO()
            with wave.open(audio,'wb') as out: voice.synthesize_wav(rendered,out)
        data=audio.getvalue()
        if not 44<=len(data)<=2_000_000: raise ValueError('audio-limit')
        print(json.dumps({'version':1,'ok':True,'kind':'tts','operationId':op,'text':text,'wav':base64.b64encode(data).decode('ascii'),'audioBytes':len(data),'elapsedMs':elapsed(at),'peakWorkingSetMiB':memory(),'timings':{'importMs':0,'modelLoadMs':0,'decodeMs':elapsed(at),'inputWaitMs':0}},ensure_ascii=False),flush=True)
        del request,text,rendered,audio,data
except Exception as error:
    print(json.dumps({'version':1,'ok':False,'code':str(error) if isinstance(error,ValueError) else 'runtime-failed'}),flush=True)
    sys.exit(1)
