import {test,expect} from '@playwright/test'
import path from 'node:path'
import {systemReplyIntegrityFiles,speechIntegrityFiles} from '../backend/voice/runtime'
const root=path.resolve('.sapi-integrity-fixture'),tts=path.join(root,'tts','voice.onnx'),asr=path.join(root,'asr'),files=[{path:tts,sha256:'a'},{path:tts+'.json',sha256:'b'},{path:path.join(asr,'model.bin'),sha256:'c'},{path:path.join(root,'shared.bin'),sha256:'d'},{path:path.join(root,'tts-lookalike','unknown.bin'),sha256:'e'}],config={python:'unused',worker:'unused',workerHash:'unused',tts,asr,files}
test('Windows reply omits only its unused model assets; unknown/shared and lookalike siblings retain checks',()=>{expect(systemReplyIntegrityFiles(config)).toEqual(files.slice(3));expect(config.files).toEqual(files)})
test('ASR and fixed Piper retain their original active and shared assets',()=>{expect(speechIntegrityFiles('asr',config)).toEqual(files.slice(2));expect(speechIntegrityFiles('tts',config)).toEqual([files[0],files[1],files[3],files[4]])})
