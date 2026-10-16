import {test,expect} from '@playwright/test'
import {assistantKnowledgeReply} from '../shared/assistantKnowledge'
import {chooseTypedTool} from '../src/voice/toolChoice'
import {needsAssistant} from '../src/voice/assistantChoice'
test('English HOW tool questions get factual local guidance without model, microphone or app proposals',()=>{
 const rows=[['How do I extract text from a photo with CiC?','OCR page'],['How do you read my screen?','unshared'],['What should I prepare for CiC slides?','draft'],['Can you remember my preferences across days?','does not'],['How do I use your microphone?','yourself'],['How do I open Chrome with CiC?','scoped consent'],['How do I use your calculator?','/calc'],['How do I search the web with CiC?','public']]
 for(const[text,expected]of rows){expect(assistantKnowledgeReply(text)).toContain(expected);const choice=chooseTypedTool(text);expect(choice.kind).toBe('answer');expect(needsAssistant(text,choice,null)).toBe(false)}
})
test('normal English actions still require their normal tool/consent route; no false completion or personal memory',()=>{
 for(const text of ['Please open Chrome','Search for indoor plants','Do not open Chrome'])expect(assistantKnowledgeReply(text)).toBeNull()
 expect(chooseTypedTool('Please open Chrome').kind).toBe('app');expect(chooseTypedTool('Search for indoor plants').kind).toBe('research')
 const memory=assistantKnowledgeReply('Can you remember my habits across days?')!;expect(memory).toContain('does not');expect(memory).not.toContain('permission granted')
 expect(assistantKnowledgeReply('What is a photo?')).toBeNull();expect(assistantKnowledgeReply('How do I study for an exam?')).toBeNull()
})

test('fresh query and note payload retain their requested meaning; expired query is a new guidance question',()=>{
 const text='How do I extract text from a photo with CiC?',now=1000;
 const query=chooseTypedTool(text,{slot:'query',question:'Search for what?',expiresAt:2000},now);expect(query.kind).toBe('research');if(query.kind==='research')expect(query.instruction).toBe('ค้นหา '+text);
 const note=chooseTypedTool(text,{slot:'notepad-text',question:'Type what?',expiresAt:2000},now);expect(note.kind).toBe('notepad');if(note.kind==='notepad')expect(note.instruction).toContain(text);
 expect(chooseTypedTool(text,{slot:'query',question:'Search for what?',expiresAt:999},now).kind).toBe('answer')
})
