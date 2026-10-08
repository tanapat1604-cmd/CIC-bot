"""Operator-configured local reader; no network, shell, user paths or model calls."""
import sys,json,time,subprocess,os,csv,math,warnings,zlib
from pathlib import Path
from PIL import Image,ImageOps
Image.MAX_IMAGE_PIXELS=4000000
warnings.simplefilter('error',Image.DecompressionBombWarning)
root=Path(sys.argv[1]);engine=sys.argv[2];data=sys.argv[3]
request=json.loads((root/'request.json').read_text(encoding='utf-8'))
start=time.perf_counter();child=None;child_peak_mib=0
# Windows process counters are measurements, not a confidence or total machine-RAM score.
def memory_peak(handle=None):
    if os.name!='nt':return None
    try:
        import ctypes
        from ctypes import wintypes
        class Counters(ctypes.Structure):
            _fields_=[('cb',wintypes.DWORD),('faults',wintypes.DWORD)]+[(name,ctypes.c_size_t) for name in ('peak_working','working','peak_paged','paged','peak_nonpaged','nonpaged','pagefile','peak_pagefile','private')]
        kernel=ctypes.WinDLL('kernel32');kernel.GetCurrentProcess.restype=ctypes.c_void_p
        api=ctypes.WinDLL('psapi').GetProcessMemoryInfo;api.argtypes=[ctypes.c_void_p,ctypes.POINTER(Counters),wintypes.DWORD];api.restype=wintypes.BOOL
        counters=Counters();counters.cb=ctypes.sizeof(counters)
        if not api(handle if handle is not None else kernel.GetCurrentProcess(),ctypes.byref(counters),counters.cb):return None
        return round(counters.peak_working/1048576,2)
    except Exception:return None
def cancelled():
    if (root/'cancel.requested').exists():raise RuntimeError('cancelled')
try:
    cancelled();p=root/'image.bin'
    if not 0<p.stat().st_size<=4194304:raise RuntimeError('too-large')
    raw=p.read_bytes()
    if raw.startswith(b'\x89PNG\r\n\x1a\n'):
        offset=8;chunks=0;ended=False
        while offset<len(raw):
            if offset+12>len(raw):raise RuntimeError('decode-failed')
            length=int.from_bytes(raw[offset:offset+4],'big');kind=raw[offset+4:offset+8];end=offset+12+length;chunks+=1
            if end>len(raw) or chunks>1024:raise RuntimeError('decode-failed')
            if zlib.crc32(raw[offset+4:offset+8+length])&0xffffffff!=int.from_bytes(raw[offset+8+length:end],'big'):raise RuntimeError('decode-failed')
            if chunks==1 and (kind!=b'IHDR' or length!=13):raise RuntimeError('decode-failed')
            if kind in (b'acTL',b'fcTL',b'fdAT'):raise RuntimeError('unsupported')
            if kind==b'IEND':
                if length!=0 or end!=len(raw):raise RuntimeError('decode-failed')
                ended=True;break
            offset=end
        if not ended:raise RuntimeError('decode-failed')
    elif raw.startswith(b'\xff\xd8') and not raw.endswith(b'\xff\xd9'):raise RuntimeError('decode-failed')
    with Image.open(p) as probe:
        if probe.format not in ('PNG','JPEG'):raise RuntimeError('unsupported')
        if probe.width>4096 or probe.height>4096 or probe.width*probe.height>4000000:raise RuntimeError('too-large')
        if probe.size!=(request['width'],request['height']):raise RuntimeError('dimensions')
        probe.verify()
    with Image.open(p) as loaded:
        if loaded.size!=(request['width'],request['height']) or getattr(loaded,'n_frames',1)!=1 or loaded.getexif().get(274,1)!=1:raise RuntimeError('unsupported')
        loaded.load()
        if 'A' in loaded.getbands():
            rgba=loaded.convert('RGBA');image=Image.new('RGB',loaded.size,'white');image.paste(rgba,mask=rgba.getchannel('A'));rgba.close()
        else:image=loaded.convert('RGB')
    words=[];texts=[];transforms=[]
    for i,r in enumerate(request['regions']):
        cancelled();x,y,w,h=r['x'],r['y'],r['width'],r['height']
        if not (0<=x<x+w<=image.width and 0<=y<y+h<=image.height):raise RuntimeError('invalid')
        scale=min(2,math.sqrt(8000000/(w*h)));tw=max(1,int(w*scale));th=max(1,int(h*scale))
        crop=ImageOps.grayscale(image.crop((x,y,x+w,y+h))).resize((tw,th),Image.Resampling.LANCZOS)
        input_file=root/f'region-{i}.png';crop.save(input_file);crop.close();prefix=root/f'output-{i}'
        command=[engine,str(input_file),str(prefix),'--tessdata-dir',data,'-l',r['language'],'--oem','1','--psm','6','txt','tsv']
        child=subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env={**os.environ,'OMP_THREAD_LIMIT':'1'},creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        (root/'child.json').write_text(json.dumps({'pid':child.pid}),encoding='utf-8')
        while child.poll() is None:
            measured=memory_peak(int(child._handle)) if os.name=='nt' else None
            if measured is not None:child_peak_mib=max(child_peak_mib,measured)
            if (root/'cancel.requested').exists() or time.perf_counter()-start>18:
                child.kill();child.wait(timeout=3);raise RuntimeError('cancelled' if (root/'cancel.requested').exists() else 'timeout')
            time.sleep(.025)
        if child.returncode!=0:raise RuntimeError('ocr-failed')
        child=None;cancelled();txt=prefix.with_suffix('.txt');tsv=prefix.with_suffix('.tsv')
        if txt.stat().st_size>65536 or tsv.stat().st_size>2097152:raise RuntimeError('output-limit')
        texts.append(txt.read_text(encoding='utf-8').strip());sx=tw/w;sy=th/h
        transforms.append({'region':i,'scaleX':sx,'scaleY':sy,'cropX':x,'cropY':y})
        with tsv.open(encoding='utf-8',newline='') as f:
            for row in csv.DictReader(f,delimiter='\t'):
                if row['level']!='5' or not row['text'].strip():continue
                words.append({'text':row['text'],'x':int(row['left'])/sx+x,'y':int(row['top'])/sy+y,'width':int(row['width'])/sx,'height':int(row['height'])/sy,'region':i})
                if len(words)>4000:raise RuntimeError('output-limit')
    text='\n\n'.join(texts)
    if len(text)>8000:raise RuntimeError('output-limit')
    result={'text':text,'words':words,'width':image.width,'height':image.height,'source':request['source'],'engine':'Tesseract fast','languages':[r['language'] for r in request['regions']],'regions':request['regions'],'transforms':transforms,'durationMs':round((time.perf_counter()-start)*1000,1)}
    result['memory']={'workerPeakMiB':memory_peak(),'engineSampledPeakMiB':child_peak_mib or None,'engineSampleIntervalMs':25,'scope':'Python worker peak + maximum Tesseract peak observed while running; excludes browser/backend/Ollama; peaks need not coincide'}
    image.close();cancelled();(root/'result.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
except Exception as error:
    known={'cancelled','timeout','too-large','unsupported','dimensions','invalid','ocr-failed','output-limit'}
    code=str(error) if str(error) in known else 'decode-failed'
    (root/'error.json').write_text(json.dumps({'code':code}),encoding='utf-8');sys.exit(1)
finally:
    if child is not None and child.poll() is None:child.kill();child.wait(timeout=3)
