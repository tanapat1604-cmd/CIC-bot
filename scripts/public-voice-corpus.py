"""Pinned public-human corpus import. No model training or production changes.
Read one archive/shard at a time; canonical PCM digest and publisher clip ID are
both unique. Indexed entries are not accepted until the complete source SHA is
verified. SQLite commits let Stop/resume retain honest counts without all WAVs.
"""
import os,sys,json,pathlib,uuid,hashlib,time,io,sqlite3,urllib.request,tarfile,struct,contextlib,runpy,ctypes
root=pathlib.Path(__file__).resolve().parents[1];op,mode=sys.argv[1:];uuid.UUID(op)
if mode not in ['setup-corpus','corpus-fleurs','corpus-libri']:raise ValueError('invalid-mode')
home=root/'.tools'/'voice-training';home.mkdir(exist_ok=True);run=home/op;run.mkdir(exist_ok=False)
dep=home/'dependencies';sys.path.insert(0,str(dep));began=time.monotonic()
report={'version':1,'operationId':op,'mode':mode,'newUniqueClips':0,'trainingUpdates':0,'productionModified':False,'fullSpeechAccepted':False,'targetUniqueClips':100000,'failures':[],'stage':'starting'}
def sha(path):
    digest=hashlib.sha256()
    with open(path,'rb') as handle:
        for block in iter(lambda:handle.read(1048576),b''):digest.update(block)
    return digest.hexdigest()
def atomic(path,value):
    temporary=path.with_name(path.name+'.tmp-'+op);temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf8');os.replace(temporary,path)
def progress(stage):
    report['stage']=stage;report['elapsedMs']=round((time.monotonic()-began)*1000);atomic(run/'PROGRESS.json',report);print('stage:'+stage,file=sys.stderr,flush=True)
if sys.platform=='win32':ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(),0x00004000)
metadata_dir=root/'validation'/'2026-10-14-training-corpus'
metadata=json.loads((metadata_dir/'PUBLIC-SOURCE-METADATA-2026-10-14T12-59-07-113Z.json').read_text(encoding='utf8'))
excluded=set(json.loads((metadata_dir/'EXCLUSION-PCM-PILOT.json').read_text(encoding='utf8'))['pcm_sha256'])
database=sqlite3.connect(home/'corpus.sqlite',timeout=5);database.execute('PRAGMA journal_mode=WAL');database.execute('PRAGMA synchronous=FULL')
database.executescript('''CREATE TABLE IF NOT EXISTS sources(key TEXT PRIMARY KEY,sha256 TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT0);
CREATE TABLE IF NOT EXISTS clips(source TEXT NOT NULL,id TEXT NOT NULL,pcm_sha256 TEXT NOT NULL UNIQUE,language TEXT NOT NULL,text TEXT NOT NULL,speaker_id TEXT,speaker_separation TEXT NOT NULL,frames INTEGER NOT NULL,source_key TEXT NOT NULL,row_index INTEGER,PRIMARY KEY(source,id));
CREATE TABLE IF NOT EXISTS rejections(source TEXT,id TEXT,reason TEXT NOT NULL,operation TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cursors(source_key TEXT PRIMARY KEY,row_index INTEGER NOT NULL);'''.replace('DEFAULT0','DEFAULT 0'))
def status():
    counts=dict(database.execute('SELECT c.language,COUNT(*) FROM clips c JOIN sources s ON c.source_key=s.key WHERE s.verified=1 GROUP BY c.language'))
    accepted=sum(counts.values());indexed=database.execute('SELECT COUNT(*) FROM clips').fetchone()[0]
    value={'version':1,'acceptedUniquePCM':accepted,'languageCounts':counts,'indexedPendingArchiveVerification':indexed-accepted,'trainingUpdates':0,'hundredThousandCorpusComplete':accepted>=100000,'hundredThousandTrainingComplete':False,'deduplication':'publisher source+clip ID and canonical16kPCM16SHA256','semanticNearDuplicateDetection':False,'lastOperationId':op}
    atomic(home/'CORPUS-STATUS.json',value);report['corpus']=value;report['newUniqueClips']=max(0,accepted-before_count);return value
before_count=database.execute('SELECT COUNT(*) FROM clips c JOIN sources s ON c.source_key=s.key WHERE s.verified=1').fetchone()[0]
def reject(source,id,reason):database.execute('INSERT INTO rejections VALUES(?,?,?,?)',(source,id,str(reason),op))
def insert(source,id,pcm,language,text,speaker,key,index=None):
    digest=hashlib.sha256(pcm).hexdigest()
    if digest in excluded:reject(source,id,'development/held PCM excluded');return
    if not text.strip() or len(pcm)%2 or not 3200<=len(pcm)<=960000:reject(source,id,'invalid text/duration/PCM');return
    if database.execute('SELECT1 FROM clips WHERE source=? AND id=?'.replace('SELECT1','SELECT 1'),(source,id)).fetchone():return
    try:database.execute('INSERT INTO clips VALUES(?,?,?,?,?,?,?,?,?,?)',(source,id,digest,language,text,speaker,'publisher train/dev/test speaker-disjoint' if source=='google/fleurs' else 'publisher speaker ID; train-clean360 only',len(pcm)//2,key,index))
    except sqlite3.IntegrityError:reject(source,id,'duplicate canonical PCM')
class Stream:
    def __init__(self,response,maximum):self.response=response;self.maximum=maximum;self.bytes=0;self.digest=hashlib.sha256()
    def read(self,n=-1):
        if n<0 or n>1048576:raise ValueError('unbounded read')
        block=self.response.read(n);self.bytes+=len(block)
        if self.bytes>self.maximum:raise ValueError('source byte budget')
        self.digest.update(block);return block
def wav_pcm(raw):
    import numpy as np
    if raw[:4]!=b'RIFF' or raw[8:12]!=b'WAVE':raise ValueError('not WAV')
    at=12;fmt=None;data=None
    while at+8<=len(raw):
        kind=raw[at:at+4];size=struct.unpack_from('<I',raw,at+4)[0];at+=8
        if at+size>len(raw):raise ValueError('truncated WAV')
        if kind==b'fmt ':fmt=struct.unpack_from('<HHIIHH',raw,at)
        if kind==b'data':data=raw[at:at+size]
        at+=size+size%2
    if not fmt or data is None:raise ValueError('WAV chunks missing')
    tag,channels,rate,_,align,bits=fmt
    if channels!=1 or rate!=16000:raise ValueError('not mono16k')
    if (tag,bits,align)==(1,16,2):return data
    if (tag,bits,align)==(3,32,4):
        values=np.frombuffer(data,dtype='<f4')
        if not np.isfinite(values).all() or np.abs(values).max()>1.001:raise ValueError('invalid float WAV')
        return np.rint(np.clip(values,-1,1)*32767).astype('<i2').tobytes()
    raise ValueError('unsupported WAV encoding')
def setup():
    progress('install-isolated-corpus-readers')
    pins=json.loads((metadata_dir/'PACKAGE-PINS-v1.json').read_text(encoding='utf8'));expected={'pyarrow':'22.0.0','soundfile':'0.13.1','cffi':'2.0.0','pycparser':'2.23'}
    requirements=[]
    for package in pins['packages']:
        if expected.get(package['name'])!=package['version'] or not package['url'].startswith('https://files.pythonhosted.org/') or len(package['sha256'])!=64:raise ValueError('untrusted package pin')
        requirements.append(package['url']+' --hash=sha256:'+package['sha256'])
    if len(requirements)!=4:raise ValueError('package set mismatch')
    requirements_path=run/'requirements.txt';requirements_path.write_text('\n'.join(requirements),encoding='utf8')
    sys.argv=['pip','install','--target',str(dep),'--no-deps','--require-hashes','--only-binary=:all:','--no-cache-dir','--disable-pip-version-check','-r',str(requirements_path)]
    with contextlib.redirect_stdout(sys.stderr):
        try:runpy.run_module('pip',run_name='__main__')
        except SystemExit as e:
            if e.code not in [None,0]:raise RuntimeError('isolated reader install failed')
    import pyarrow,soundfile,cffi,pycparser
    report['readerVersions']={m.__name__:m.__version__ for m in [pyarrow,soundfile,cffi,pycparser]};report['target']=str(dep);report['productionPythonChanged']=False
def fleurs():
    source=next(s for s in metadata['outputs'] if s['id']=='google/fleurs')
    for language,code in [('th','th_th'),('en','en_us')]:
        file=next(f for f in source['files'] if f['path']=='data/'+code+'/audio/train.tar.gz');key=source['id']+'@'+source['revision']+':'+file['path'];expected=file['lfs']['sha256']
        old=database.execute('SELECT sha256,verified FROM sources WHERE key=?',(key,)).fetchone()
        if old and old!=(expected,1) and old[0]!=expected:raise ValueError('source pin changed')
        if old and old[1]==1:continue
        database.execute('INSERT OR IGNORE INTO sources VALUES(?,?,0)',(key,expected));database.commit();progress('stream-fleurs-'+language)
        table=metadata_dir/('SOURCE-2026-10-14T13-19-55-674Z-data_'+code+'_train.tsv');expected_table={'th':'cc10925ee1c45521ce8289cadb340329945b4580fdf020b747b78697877d0b43','en':'3ccfc83672cc03a835143e325abb38b4163e3a21725bc1a7d1165bc309b95852'}[language]
        if sha(table)!=expected_table:raise ValueError('TSV integrity')
        rows={r[1]:r for r in (line.split('\t') for line in table.read_text(encoding='utf8').splitlines())}
        with urllib.request.urlopen('https://huggingface.co/datasets/google/fleurs/resolve/'+source['revision']+'/'+file['path'],timeout=20) as response:
            stream=Stream(response,file['bytes']);seen_members=set()
            with tarfile.open(fileobj=stream,mode='r|gz') as archive:
                for member in archive:
                    name=pathlib.PurePosixPath(member.name).name
                    if not member.isfile():continue
                    if name not in rows:reject(source['id'],name,'not publisher train annotation');continue
                    if name in seen_members:raise ValueError('duplicate archive member')
                    seen_members.add(name);row=rows[name]
                    if int(row[5])>480000:reject(source['id'],name,'longer than frozen30s bound');continue
                    if database.execute('SELECT 1 FROM clips WHERE source=? AND id=?',(source['id'],language+':'+name)).fetchone():continue
                    if member.size>4000000:raise ValueError('member memory budget')
                    try:
                        pcm=wav_pcm(archive.extractfile(member).read(member.size))
                        if len(pcm)//2!=int(row[5]):raise ValueError('publisher sample count mismatch')
                        insert(source['id'],language+':'+name,pcm,language,row[3],None,key)
                    except ValueError as error:reject(source['id'],name,error)
                    if len(seen_members)%32==0:database.commit();status();progress('indexed-fleurs-'+language)
            while stream.read(65536):pass
            if stream.bytes!=file['bytes'] or stream.digest.hexdigest()!=expected:raise ValueError('complete archive integrity failed')
        database.execute('UPDATE sources SET verified=1 WHERE key=?',(key,));database.commit();status();progress('verified-fleurs-'+language)
def librispeech():
    import pyarrow as pa,pyarrow.parquet as pq,soundfile as sf
    pa.set_cpu_count(3);pa.set_io_thread_count(1)
    source=next(s for s in metadata['outputs'] if s['id']=='openslr/librispeech_asr')
    files=sorted([f for f in source['files'] if f['path'].startswith('all/train.clean.360/') and f['path'].endswith('.parquet')],key=lambda f:f['path'])
    if not files:raise ValueError('publisher train-clean360 absent')
    cache=home/'cache';cache.mkdir(exist_ok=True);target=cache/'current.parquet';stamp=cache/'CACHE.json'
    owner=cache/'OWNER.json'
    if cache.is_symlink() or cache.resolve()!=home.resolve()/'cache':raise ValueError('unsafe cache directory')
    if not owner.exists():atomic(owner,{'owner':'cic-public-corpus-v1'})
    if json.loads(owner.read_text(encoding='utf8')).get('owner')!='cic-public-corpus-v1':raise ValueError('unowned cache directory')
    cleanup=[]
    for leftover in cache.glob('*.part'):
        uuid.UUID(leftover.stem)
        if leftover.is_symlink() or leftover.resolve().parent!=cache.resolve():raise ValueError('unsafe partial cache file')
        cleanup.append({'file':leftover.name,'bytes':leftover.stat().st_size,'sha256':sha(leftover),'purpose':'orphan owned partial from verified stopped earlier job; scratch bytes, receipts retained'})
        leftover.unlink()
    if cleanup:atomic(run/'CACHE-CLEANUP.json',{'files':cleanup})
    for file in files:
        key=source['id']+'@'+source['revision']+':'+file['path'];expected=file['lfs']['sha256'];prior=database.execute('SELECT verified FROM sources WHERE key=?',(key,)).fetchone()
        if prior and prior[0]==1 and database.execute('SELECT row_index FROM cursors WHERE source_key=?',(key,)).fetchone()[0]==-1:continue
        if file['bytes']>536870912:raise ValueError('shard exceeds512MiB cache budget')
        cached=json.loads(stamp.read_text(encoding='utf8')) if stamp.exists() else None
        if not cached or cached.get('source_key')!=key or not target.exists() or sha(target)!=expected:
            # Delete only this importer's exact owned cache file after path checks.
            if target.is_symlink() or cache.resolve()!=home.resolve()/'cache':raise ValueError('unsafe cache path')
            if target.exists():
                if not cached or cached.get('ownedBy')!='cic-public-corpus-v1':raise ValueError('unowned cache')
                target.unlink()
            part=cache/(op+'.part');progress('download-'+file['path'])
            with urllib.request.urlopen('https://huggingface.co/datasets/openslr/librispeech_asr/resolve/'+source['revision']+'/'+file['path'],timeout=20) as response,open(part,'xb') as out:
                stream=Stream(response,file['bytes'])
                while True:
                    block=stream.read(1048576)
                    if not block:break
                    out.write(block)
            if stream.bytes!=file['bytes'] or stream.digest.hexdigest()!=expected:raise ValueError('shard integrity')
            os.replace(part,target);atomic(stamp,{'source_key':key,'sha256':expected,'bytes':file['bytes'],'ownedBy':'cic-public-corpus-v1'})
        database.execute('INSERT OR IGNORE INTO sources VALUES(?,?,1)',(key,expected));database.execute('INSERT OR IGNORE INTO cursors VALUES(?,0)',(key,));database.commit()
        offset=database.execute('SELECT row_index FROM cursors WHERE source_key=?',(key,)).fetchone()[0];progress('decode-'+file['path']);parquet=pq.ParquetFile(target)
        for index,batch in enumerate(parquet.iter_batches(batch_size=1,use_threads=False)):
            if index<offset:continue
            row=batch.to_pylist()[0];id=row['id'];text=row['text'];speaker=str(row['speaker_id'])
            try:
                raw=row['audio']['bytes']
                if not isinstance(raw,bytes) or len(raw)>4000000:raise ValueError('audio member budget')
                with sf.SoundFile(io.BytesIO(raw)) as audio:
                    if audio.samplerate!=16000 or audio.channels!=1 or audio.subtype!='PCM_16' or not 1600<=audio.frames<=480000:raise ValueError('not canonical16kPCM16 or duration bound')
                    pcm=audio.read(dtype='int16',always_2d=False).astype('<i2').tobytes()
                insert(source['id'],id,pcm,'en',text,speaker,key,index)
            except ValueError as error:reject(source['id'],id,error)
            database.execute('UPDATE cursors SET row_index=? WHERE source_key=?',(index+1,key))
            if (index+1)%32==0:
                database.commit();counts=status();progress('indexed-'+file['path'])
                if counts['acceptedUniquePCM']>=100000:return
            if time.monotonic()-began>180:database.commit();status();report['boundedBatchComplete']=True;return
        database.execute('UPDATE cursors SET row_index=-1 WHERE source_key=?',(key,));database.commit();counts=status()
        # One verified shard per owned request; next request resumes next shard.
        report['boundedBatchComplete']=True;report['shardRows']=parquet.metadata.num_rows;return
try:
    if mode=='setup-corpus':setup()
    elif mode=='corpus-fleurs':fleurs()
    else:librispeech()
    database.commit();status();report['state']='succeeded';progress('complete');print(json.dumps(report,ensure_ascii=False),flush=True)
except Exception as error:
    database.rollback();report['state']='failed';report['error']=str(error);progress('failed');print(json.dumps(report,ensure_ascii=False),flush=True);raise
finally:database.close()
