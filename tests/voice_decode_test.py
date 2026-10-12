"""Production ASR request/decode contract with a fake engine, not recognition acceptance."""
import ast,base64,pathlib,sys,types,unittest
import numpy as np
worker=pathlib.Path(__file__).parents[1]/'backend'/'voice'/'worker.py'
tree=ast.parse(worker.read_text(encoding='utf-8'))
scope={'version':lambda name:'1.2.1','base64':base64}
for name in ('has_signal','run'):
    fn=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name==name)
    exec(compile(ast.Module(body=[fn],type_ignores=[]),str(worker),'exec'),scope)
class DecodeContractTests(unittest.TestCase):
    def setUp(self):
        self.old=sys.modules.get('faster_whisper');self.options=None
        self.pieces=[types.SimpleNamespace(text=' เปิดโครมให้หน่อย',avg_logprob=-.2,compression_ratio=1.1)]
        owner=self
        class Engine:
            def __init__(self,*args,**kwargs):owner.modelOptions=kwargs
            def transcribe(self,audio,**kwargs):owner.options=kwargs;return iter(owner.pieces),types.SimpleNamespace(language='th')
        fake=types.ModuleType('faster_whisper');fake.WhisperModel=Engine;sys.modules['faster_whisper']=fake
        pcm=(np.sin(np.arange(16000)/10)*.1*32767).astype('<i2').tobytes()
        self.request={'kind':'asr','pcm':base64.b64encode(pcm).decode(),'language':'th'}
    def tearDown(self):
        if self.old is None:sys.modules.pop('faster_whisper',None)
        else:sys.modules['faster_whisper']=self.old
    def execute(self,**extra):return scope['run']({**self.request,**extra},pathlib.Path('.'))
    def test_bounded_profile_preserves_raw_text_and_no_action_authority(self):
        result=self.execute(decodeProfile='thai-command-v1')
        self.assertEqual(result['text'],'เปิดโครมให้หน่อย')
        self.assertEqual(self.options['beam_size'],1)
        self.assertEqual(self.options['temperature'],0.0)
        self.assertTrue(self.options['without_timestamps'])
        self.assertIsNone(self.options['initial_prompt'])
        self.assertEqual(self.modelOptions['cpu_threads'],3)
        self.assertNotIn('permission',result)
    def test_legacy_keeps_beam_five_context_and_fallback_temperature(self):
        self.execute(context='apps')
        self.assertEqual(self.options['beam_size'],5)
        self.assertNotIn('temperature',self.options)
        self.assertFalse(self.options['without_timestamps'])
        self.assertIn('Chrome',self.options['initial_prompt'])
    def test_silence_bad_profile_extra_fields_and_low_confidence_fail_closed(self):
        for extra in [{'pcm':base64.b64encode(bytes(32000)).decode()},{'decodeProfile':'other'},{'command':'open.exe'}]:
            with self.assertRaises(ValueError):self.execute(**extra)
        self.pieces[0].avg_logprob=-1.01
        with self.assertRaisesRegex(ValueError,'uncertain-speech'):self.execute(decodeProfile='thai-command-v1')
    def test_repetition_is_rejected_without_repairing_text(self):
        self.pieces[0].compression_ratio=2.41
        with self.assertRaisesRegex(ValueError,'uncertain-speech'):self.execute(decodeProfile='thai-command-v1')
        # Normal Thai sentences can exceed 2.0; the standard 2.4 boundary remains accepted.
        self.pieces[0].compression_ratio=2.4
        self.assertEqual(self.execute(decodeProfile='thai-command-v1')['text'],'เปิดโครมให้หน่อย')
if __name__=='__main__':unittest.main()
