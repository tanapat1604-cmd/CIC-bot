"""One bounded reply per owned Piper process. Offline; no microphone or text cache."""
import base64, contextlib, ctypes, io, json, os, pathlib, sys, time, wave
from importlib.metadata import version

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
def offline(event, args):
    if event in ('socket.connect', 'socket.getaddrinfo'):
        raise RuntimeError('network-disabled')
sys.addaudithook(offline)
started = time.monotonic()
timings = {'importMs': 0, 'modelLoadMs': 0, 'decodeMs': 0, 'inputWaitMs': 0}
def elapsed(at):
    return round((time.monotonic() - at) * 1000)
def memory():
    if sys.platform != 'win32':
        return None
    class Counters(ctypes.Structure):
        _fields_ = [('cb', ctypes.c_ulong), ('PageFaultCount', ctypes.c_ulong)] + [(n, ctypes.c_size_t) for n in ['PeakWorkingSetSize', 'WorkingSetSize', 'QuotaPeakPagedPoolUsage', 'QuotaPagedPoolUsage', 'QuotaPeakNonPagedPoolUsage', 'QuotaNonPagedPoolUsage', 'PagefileUsage', 'PeakPagefileUsage', 'PrivateUsage']]
    c = Counters(); c.cb = ctypes.sizeof(c)
    ctypes.windll.kernel32.GetCurrentProcess.restype = ctypes.c_void_p
    f = ctypes.windll.psapi.GetProcessMemoryInfo
    f.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong]
    return round(c.PeakWorkingSetSize / 1048576, 2) if f(ctypes.windll.kernel32.GetCurrentProcess(), ctypes.byref(c), c.cb) else None
try:
    if len(sys.argv) != 2:
        raise ValueError('invalid')
    waiting = time.monotonic(); raw = sys.stdin.buffer.read(8193)
    timings['inputWaitMs'] = elapsed(waiting)
    if len(raw) > 8192:
        raise ValueError('input-limit')
    request = json.loads(raw)
    text = request.get('text')
    if set(request) != {'kind', 'text'} or request['kind'] != 'tts' or not isinstance(text, str) or not 1 <= len(text) <= 600 or text != text.strip() or any(ord(c) < 32 or 127 <= ord(c) <= 159 for c in text):
        raise ValueError('invalid-audio')
    model = pathlib.Path(sys.argv[1]).resolve()
    if version('piper-tts') != '1.8.0':
        raise ValueError('invalid')
    with contextlib.redirect_stdout(sys.stderr):
        at = time.monotonic()
        import onnxruntime as ort
        from piper import PiperVoice
        from piper.config import PiperConfig
        timings['importMs'] = elapsed(at); at = time.monotonic()
        config = PiperConfig.from_dict(json.loads(pathlib.Path(str(model) + '.json').read_text(encoding='utf-8')))
        options = ort.SessionOptions(); options.intra_op_num_threads = 3; options.inter_op_num_threads = 1
        voice = PiperVoice(config=config, session=ort.InferenceSession(str(model), sess_options=options, providers=['CPUExecutionProvider']), download_dir=model.parent)
        timings['modelLoadMs'] = elapsed(at); at = time.monotonic()
        audio = io.BytesIO()
        with wave.open(audio, 'wb') as out:
            voice.synthesize_wav(text, out)
        timings['decodeMs'] = elapsed(at)
    data = audio.getvalue()
    if not 44 <= len(data) <= 2_000_000:
        raise ValueError('audio-limit')
    print(json.dumps({'version': 1, 'ok': True, 'kind': 'tts', 'text': text, 'wav': base64.b64encode(data).decode('ascii'), 'audioBytes': len(data), 'elapsedMs': elapsed(started), 'peakWorkingSetMiB': memory(), 'timings': timings}, ensure_ascii=False))
except Exception as error:
    print(json.dumps({'version': 1, 'ok': False, 'code': str(error) if isinstance(error, ValueError) else 'runtime-failed', 'timings': timings}))
    sys.exit(1)
