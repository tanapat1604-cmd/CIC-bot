import ast,json,pathlib,tempfile,unittest,numpy as np
worker=pathlib.Path('D:/CIC bot/CIC-bot/backend/voice/worker-cv8.py')
tree=ast.parse(worker.read_text(encoding='utf-8'));scope={'json':json}
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ('cv8_tokenizer','decode_ctc')],type_ignores=[]),str(worker),'exec'),scope)
model=pathlib.Path('D:/CIC bot/CIC-bot/.tools/voice-models/wav2vec2-th-cv8-int8-v1');tokens=scope['cv8_tokenizer'](model);decode=scope['decode_ctc'];blank=69
def logits(ids,width=72):
    result=np.full((len(ids),width),-10,dtype=np.float32)
    for i,value in enumerate(ids):result[i,value]=10
    return result
class CV8(unittest.TestCase):
    def test_all_ids_and_publisher_tokens(self):self.assertEqual(set(tokens),set(range(72)));self.assertEqual([tokens[70],tokens[71]],['<s>','</s>'])
    def test_raw_stop(self):self.assertEqual(decode(logits([69,5,5,12,60,18,69]),tokens,blank),'หยุด')
    def test_blank_preserves_repeat(self):self.assertEqual(decode(logits([5,69,5,12,60,18]),tokens,blank),'หหยุด')
    def test_spaces(self):self.assertEqual(decode(logits([5,12,60,18,46,5,12,60,18]),tokens,blank),'หยุด หยุด')
    def test_specials_and_unknown_refused(self):
        for value in (68,70,71):
            with self.subTest(value=value),self.assertRaisesRegex(ValueError,'uncertain-speech'):decode(logits([5,value,18]),tokens,blank)
    def test_wrong_width_refused(self):
        with self.assertRaisesRegex(ValueError,'uncertain-speech'):decode(logits([5],70),tokens,blank)
    def test_low_confidence_refused(self):
        with self.assertRaisesRegex(ValueError,'uncertain-speech'):decode(np.zeros((5,72),np.float32),tokens,blank)
    def test_nonfinite_refused(self):
        a=logits([5]);a[0,0]=np.nan
        with self.assertRaisesRegex(ValueError,'uncertain-speech'):decode(a,tokens,blank)
    def test_blank_refused(self):
        with self.assertRaisesRegex(ValueError,'no-speech'):decode(logits([69]*5),tokens,blank)
    def test_bad_added_mapping_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            target=pathlib.Path(folder)
            for name in ['vocab.json','added_tokens.json','special_tokens_map.json','tokenizer_config.json','config.json']:(target/name).write_bytes((model/name).read_bytes())
            (target/'added_tokens.json').write_text(json.dumps({'<s>':1,'</s>':2}))
            with self.assertRaisesRegex(ValueError,'invalid-tokenizer'):scope['cv8_tokenizer'](target)
unittest.main()
