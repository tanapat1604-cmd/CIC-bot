import {classifyVoiceCommand} from './appOpen.js'
import {exact} from './core.js'
export function validateAppIntentProposal(rawText:string,proposal:unknown){
 if(!exact(proposal,['kind'])||!['chrome','notepad','youtube'].includes(String(proposal.kind)))return null
 const bounded=classifyVoiceCommand(rawText)
 if(bounded.kind!==proposal.kind)return null
 return{rawText,canonicalTarget:bounded.kind,instruction:bounded.instruction,permissionGranted:false as const,asrAccepted:false as const,authority:'proposal-only' as const}
}
