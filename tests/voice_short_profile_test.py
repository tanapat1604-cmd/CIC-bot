"""Experimental gate contracts with fake engine; real human inference is separate."""
import ast,base64,os,pathlib,sys,time,types,unittest
import numpy as np
worker=pathlib.Path(__file__).parents[1]/'backend/voice/worker-short-speech.py'
tree=ast.parse(worker.read_text(encoding='utf-8'));scope={'os':os,'version':lambda name:'1.2.1','base64':base64,'time':time,'timings':{'importMs':0,'modelLoadMs':0,'decodeMs':0,'inputWaitMs':0}}
for name in ['elapsed','load_asr','has_signal','run']:
    fn=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name==name)
    exec(compile(ast.Module(body=[fn],type_ignores=[]),str(worker),'exec'),scope)
class ShortProfileTests(unittest.TestCase):
    def setUp(self):
        self.old=sys.modules.get('faster_whisper');self.pieces=[types.SimpleNamespace(text='หยุด',avg_logprob=-.2,compression_ratio=1.)];owner=self
        class Engine:
            def __init__(self,*args,**kwargs):pass
            def transcribe(self,audio,**kwargs):owner.options=kwargs;return iter(owner.pieces),types.SimpleNamespace(language='th')
        fake=types.ModuleType('faster_whisper');fake.WhisperModel=Engine;sys.modules['faster_whisper']=fake
        audio=np.zeros(16000,dtype='<i2');audio[3200:7040]=(np.sin(np.arange(3840)/10)*.1*32767).astype('<i2')
        self.request={'kind':'asr','pcm':base64.b64encode(audio.tobytes()).decode(),'language':'th','decodeProfile':'thai-command-v1'}
    def tearDown(self):
        if self.old is None:sys.modules.pop('faster_whisper',None)
        else:sys.modules['faster_whisper']=self.old
    def test_default_250_rejects_and_180_preserves_raw_text_and_decode_guards(self):
        with self.assertRaisesRegex(ValueError,'no-speech'):scope['run'](self.request,pathlib.Path('.'))
        self.assertEqual(scope['run']({**self.request,'minimumActivityMs':180},pathlib.Path('.'))['text'],'หยุด')
        self.assertEqual(self.options['beam_size'],1);self.assertTrue(self.options['vad_filter']);self.assertIsNone(self.options['initial_prompt'])
    def test_minimum_profile_validation_silence_and_transient(self):
        for value in [120,179,181,251,'180',None]:
            with self.assertRaises(ValueError):scope['has_signal'](np.zeros(16000),value)
        transient=np.zeros(16000,dtype=np.float32);transient[20]=.9
        self.assertFalse(scope['has_signal'](transient,180));self.assertFalse(scope['has_signal'](np.zeros(16000),180))
    def test_uncertainty_and_repetition_checks_stay_intact(self):
        self.pieces[0].avg_logprob=-1.01
        with self.assertRaisesRegex(ValueError,'uncertain-speech'):scope['run']({**self.request,'minimumActivityMs':180},pathlib.Path('.'))
        self.pieces[0].avg_logprob=-.2;self.pieces[0].compression_ratio=2.41
        with self.assertRaisesRegex(ValueError,'uncertain-speech'):scope['run']({**self.request,'minimumActivityMs':180},pathlib.Path('.'))
    def test_protocol_minimum_unchanged_and_extra_fields_never_gain_authority(self):
        for extra in [{'pcm':base64.b64encode(bytes(7998)).decode()},{'minimumActivityMs':180,'approved':True}]:
            with self.assertRaises(ValueError):scope['run']({**self.request,**extra},pathlib.Path('.'))
if __name__=='__main__':unittest.main()
