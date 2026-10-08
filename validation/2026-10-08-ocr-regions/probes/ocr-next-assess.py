import json,hashlib,subprocess,os,time,re,unicodedata,csv,ctypes as C,ctypes.wintypes as W
from pathlib import Path
from PIL import Image,ImageOps
root=Path('output/2026-10-07-ocr-next');manifest=root/'manifest.json';cases=json.loads(manifest.read_text(encoding='utf-8'))
if (root/'FREEZE.json').exists():raise RuntimeError('Do not replace prior experiment')
freeze={'created':time.time(),'manifestHash':hashlib.sha256(manifest.read_bytes()).hexdigest(),'imageHashes':{c['file']:hashlib.sha256((root/c['file']).read_bytes()).hexdigest() for c in cases},'baseline':'tha+eng PSM3 full image','candidate':'explicit user language and manually selected regions, each crop 2x Lanczos, grayscale, PSM6; column regions read in user order','gate':'Every clear Thai/mixed image CER<=5%, English<=2%, numbers/times exact, blank empty, selected columns order exact. Blur separately unsupported if omissions/errors; no automatic uncertainty claim. No model repairs. No result-driven policy changes.'}
(root/'FREEZE.json').write_text(json.dumps(freeze,indent=2),encoding='utf-8')
class Counters(C.Structure):
 _fields_=[('cb',W.DWORD),('PageFaultCount',W.DWORD)]+[(x,C.c_size_t) for x in ['PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage','PrivateUsage']]
kernel=C.WinDLL('kernel32',use_last_error=True);psapi=C.WinDLL('psapi',use_last_error=True);kernel.OpenProcess.argtypes=[W.DWORD,W.BOOL,W.DWORD];kernel.OpenProcess.restype=W.HANDLE;kernel.CloseHandle.argtypes=[W.HANDLE];psapi.GetProcessMemoryInfo.argtypes=[W.HANDLE,C.POINTER(Counters),W.DWORD]
def norm(s):return re.sub(r'\s+','',unicodedata.normalize('NFC',s))
def metric(a,b):
 a,b=norm(a),norm(b);last=list(range(len(b)+1))
 for i,x in enumerate(a,1):
  curr=[i]
  for j,y in enumerate(b,1):curr.append(min(curr[-1]+1,last[j]+1,last[j-1]+(x!=y)))
  last=curr
 return {'cer':round(100*last[-1]/len(a),2) if a else None,'exact':a==b,'edits':last[-1]}
def recognize(image,prefix,lang,psm,transform):
 cmd=[r'D:\CIC bot\CIC-bot\.tools\ocr-tesseract-5.5.3\tesseract.exe',str(image.resolve()),str(prefix.resolve()),'--tessdata-dir',r'D:\CIC bot\CIC-bot\.tools\ocr-tesseract-5.5.3\tessdata','-l',lang,'--oem','1','--psm',str(psm),'txt','tsv']
 start=time.perf_counter();p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=subprocess.CREATE_NO_WINDOW,env={**os.environ,'OMP_THREAD_LIMIT':'1'});h=kernel.OpenProcess(0x1010,False,p.pid);peak=0
 try:
  while p.poll() is None:
   counter=Counters();counter.cb=C.sizeof(counter)
   if h and psapi.GetProcessMemoryInfo(h,C.byref(counter),counter.cb):peak=max(peak,counter.WorkingSetSize/1048576)
   if time.perf_counter()-start>20:p.kill();raise RuntimeError('OCR timeout')
   time.sleep(.025)
 finally:
  if h:kernel.CloseHandle(h)
 out,err=p.communicate();assert p.returncode==0,err.decode(errors='replace')
 text=prefix.with_suffix('.txt').read_text(encoding='utf-8');words=[]
 with prefix.with_suffix('.tsv').open(encoding='utf-8',newline='') as f:
  for row in csv.DictReader(f,delimiter='\t'):
   if row['level']=='5' and row['text'].strip():
    words.append({'text':row['text'],'x':int(row['left'])/transform['scale']+transform['x'],'y':int(row['top'])/transform['scale']+transform['y'],'width':int(row['width'])/transform['scale'],'height':int(row['height'])/transform['scale'],'nativeWordScore':float(row['conf'])})
 return {'text':text,'words':words,'ms':round((time.perf_counter()-start)*1000,1),'peakMiB':round(peak,1),'language':lang,'psm':psm,'transform':transform}
results=[]
for case in cases:
 for variant in ['baseline','candidate']:
  d=root/(case['id']+'-'+variant);d.mkdir();reads=[];started=time.perf_counter()
  if variant=='baseline':reads.append(recognize(root/case['file'],d/'raw','tha+eng',3,{'scale':1,'x':0,'y':0}))
  else:
   image=Image.open(root/case['file']).convert('RGB')
   for n,region in enumerate(case['regions']):
    x,y,w,h=region['box'];crop=ImageOps.grayscale(image.crop((x,y,x+w,y+h))).resize((w*2,h*2),Image.Resampling.LANCZOS);file=d/f'region-{n}.png';crop.save(file);reads.append(recognize(file,d/f'raw-{n}',region['language'],6,{'scale':2,'x':x,'y':y}))
  actual='\n'.join(r['text'].strip() for r in reads);m=metric(case['expected'],actual);positions=[norm(actual).find(norm(line)) for line in case['lines']];order='empty' if not positions else 'missing-text' if min(positions)<0 else 'correct' if positions==sorted(positions) else 'wrong'
  item={'id':case['id'],'split':case['split'],'variant':variant,'expected':case['expected'],'actual':actual,'metric':m,'order':order,'ms':round((time.perf_counter()-started)*1000,1),'peakSampleMiB':max(r['peakMiB'] for r in reads),'reads':reads,'manualRegions':case['regions'] if variant=='candidate' else None}
  (d/'result.json').write_text(json.dumps(item,ensure_ascii=False,indent=2),encoding='utf-8');results.append(item)
  print(json.dumps({k:item[k] for k in ['id','variant','metric','order','ms','peakSampleMiB']},ensure_ascii=True),flush=True)
assert hashlib.sha256(manifest.read_bytes()).hexdigest()==freeze['manifestHash']
(root/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print('Done 48 case/pipeline results; per-region OCR calls recorded separately')
