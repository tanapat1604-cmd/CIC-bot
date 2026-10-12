"""Production signal gate regression; synthetic data, no model or microphone."""
import ast,pathlib,unittest
import numpy as np
worker=pathlib.Path(__file__).parents[1]/'backend'/'voice'/'worker.py'
tree=ast.parse(worker.read_text(encoding='utf-8'))
fn=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='has_signal')
scope={};exec(compile(ast.Module(body=[fn],type_ignores=[]),str(worker),'exec'),scope)
has_signal=scope['has_signal']
class SignalGateTests(unittest.TestCase):
    def signal(self,n,amplitude):
        return (np.round(np.sin(np.arange(n)/10)*amplitude*32767).astype('<i2').astype(np.float32)/32768)
    def test_padding_does_not_reject_audible_signal(self):
        audio=np.concatenate((np.zeros(3200),self.signal(16000,.010),np.zeros(3200))).astype(np.float32)
        self.assertLess(float(np.sqrt(np.mean(audio*audio))),.007)
        self.assertTrue(has_signal(audio))
    def test_internal_pause_is_not_a_new_silence_rejection(self):
        audio=np.concatenate((self.signal(8000,.010),np.zeros(200000),self.signal(8000,.010))).astype(np.float32)
        self.assertTrue(has_signal(audio))
    def test_silence_weak_input_and_transient_still_rejected(self):
        for audio in [np.zeros(240000,dtype=np.float32),self.signal(16000,.003),self.signal(320,.8),np.array([],dtype=np.float32)]:
            self.assertFalse(has_signal(audio))
    def test_activity_duration_boundary(self):
        self.assertFalse(has_signal(self.signal(3840,.1)))
        self.assertTrue(has_signal(self.signal(4000,.1)))
if __name__=='__main__':unittest.main()
