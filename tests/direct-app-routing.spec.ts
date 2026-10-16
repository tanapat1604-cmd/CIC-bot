import {test,expect} from '@playwright/test'
import {chooseTypedTool} from '../src/voice/toolChoice'
import {needsAssistant} from '../src/voice/assistantChoice'
test('direct dev: clear prepared-app requests go to the existing app plan without AI',()=>{
 for(const [text,instruction]of [['ช่วยเตรียม Chrome เพื่อเปิดเว็บให้หน่อย','เปิด Chrome'],['เตรียม Notepad สำหรับจดบันทึก','เปิด Notepad'],['prepare YouTube for watching videos','เปิด YouTube']]){
  const choice=chooseTypedTool(text);expect(choice).toEqual({kind:'app',instruction});expect(needsAssistant(text,choice,null)).toBe(false)
 }
});
test('direct held: spelling and polite phrasing retain the named target without editing the transcript',()=>{
 for(const [text,instruction]of [['กรุณาเตรียมโครมไว้ท่องเว็บครับ','เปิด Chrome'],['ช่วยเตรียมสมุดบันทึกไว้จดบันทึกหน่อย','เปิด Notepad'],['เตรียมยูทูบสำหรับดูคลิปค่ะ','เปิด YouTube']])expect(chooseTypedTool(text)).toEqual({kind:'app',instruction})
});
test('direct held: explanations, ambiguous targets, extra commands and negation cannot become a prepared launch',()=>{
 for(const text of ['อธิบายวิธีเตรียม Chrome เพื่อเปิดเว็บ','เตรียม Chrome หรือ Notepad เพื่อเปิดเว็บ','เตรียม Chrome เพื่อเปิดเว็บแล้วลบไฟล์','ช่วยเตรียม Chrome เพื่อเปิดเว็บได้ไหม','เตรียม Notepad เพื่อเปิดเว็บ'])expect(chooseTypedTool(text).kind).not.toBe('app')
 expect(chooseTypedTool('อย่าเตรียม Chrome เพื่อเปิดเว็บ')).toEqual({kind:'app',instruction:'อย่าเตรียม Chrome เพื่อเปิดเว็บ'})
});
