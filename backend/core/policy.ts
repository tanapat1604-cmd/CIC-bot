import {randomUUID} from 'node:crypto'
import {CoreError,type CoreTool} from '../../shared/core.js'
export type ActionEnvelope={version:1;policyVersion:1;taskId:string;sessionId:string;operationId:string;agentId:'UtilityAgent';toolId:CoreTool;args:{expression:string};grantId:string;target:{kind:'local-tool';id:CoreTool};observationId:null;geometryVersion:null;deadline:number;preconditions:['owned-reviewed-plan'];postconditions:['exact-tool-output']}
type Grant={id:string;owner:string;taskId:string;operationId:string;tool:CoreTool;expression:string;expires:number;used:boolean;revoked:boolean}
export function createPolicy(clock=()=>performance.now()){
 const grants=new Map<string,Grant>()
 return {
  issue(owner:string,taskId:string,operationId:string,tool:CoreTool,expression:string,deadline:number){
   if(grants.size>=32)throw new CoreError('capacity');const g:Grant={id:randomUUID(),owner,taskId,operationId,tool,expression,expires:Math.min(clock()+30000,deadline),used:false,revoked:false};grants.set(g.id,g);return g.id
  },
  consume(owner:string,a:ActionEnvelope){
   const g=grants.get(a.grantId);
   if(!g||g.owner!==owner||g.taskId!==a.taskId||g.operationId!==a.operationId||g.tool!==a.toolId||g.expression!==a.args.expression||g.revoked||g.used||g.expires<=clock()||a.deadline<=clock()||a.version!==1||a.policyVersion!==1||a.sessionId!==owner||a.agentId!=='UtilityAgent'||a.target.kind!=='local-tool'||a.target.id!==g.tool||a.observationId!==null||a.geometryVersion!==null||a.preconditions.length!==1||a.preconditions[0]!=='owned-reviewed-plan'||a.postconditions.length!==1||a.postconditions[0]!=='exact-tool-output')throw new CoreError('permission-denied')
   g.used=true
  },
  revoke(id:string){const g=grants.get(id);if(g)g.revoked=true},
  remove(id:string){grants.delete(id)},
  close(){grants.clear()},
 }
}
