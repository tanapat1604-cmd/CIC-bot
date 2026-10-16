import type {TurnEvidence} from './evidence'
// Activity boundary and callback time are diagnostic estimates, not a labelled
// speech boundary or proof that ASR, an answer or a native action was correct.
export function turnLatency(row:TurnEvidence){
 if(row.source==='microphone'&&row.liveSpeech){
  const live=row.liveSpeech,endAt=live.speechEndedAt
  if(endAt===undefined)return{accepted:false as const,reason:'no-browser-speechend-boundary'}
  const delta=(at:number|undefined)=>at!==undefined&&at>=endAt?Math.round(at-endAt):undefined
  const fullReply=!!row.reply&&row.tts?.state==='succeeded'&&row.tts.text===row.reply.replace(/\s+/gu,' ').trim()
  return{accepted:false as const,boundary:'browser-speechend-event-estimate' as const,speechEndEventAt:endAt,endpointLatencyUnmeasured:true as const,inputLatencyUnmeasured:true as const,outputDeviceLatencyUnmeasured:true as const,
   eventToFinalMs:delta(live.finalAt),eventToRecognizerEndMs:delta(live.recognizerEndedAt),eventToReplyRecordedMs:delta(row.replyRecordedAt),eventToUtilityCompleteMs:row.utility?.status==='complete'?delta(row.utility.completedAt):undefined,eventToFullReplyPlaybackMs:fullReply?delta(row.tts?.playbackStartedAt):undefined,
   correctnessHumanReviewed:row.humanApproved===true}
 }
 const signal=row.signal,clock=signal?.sampleClock
 const unavailable={accepted:false as const,reason:row.source==='typed'?'typed-input':'no-signal-clock'}
 if(row.source!=='microphone'||!clock||signal?.lastSignalMs===undefined)return unavailable
 const endAt=clock.sampledThroughAt-(signal.durationMs-signal.lastSignalMs)
 if(!Number.isFinite(endAt)||signal.lastSignalMs<0||signal.lastSignalMs>signal.durationMs)return{accepted:false as const,reason:'invalid-signal-clock'}
 const interval=(at:number|undefined)=>at!==undefined&&Number.isFinite(at)&&at>=endAt?Math.round(at-endAt):undefined
 const fullReply=!!row.reply&&row.tts?.state==='succeeded'&&row.tts.text===row.reply.replace(/\s+/gu,' ').trim()
 const actualUtility=row.utility?.status==='complete'&&['calculator','time-calculator','clock'].includes(row.utility.source)
 return{accepted:false as const,boundary:'signal-activity-estimate' as const,signalEndEstimatedAt:endAt,inputLatencyUnmeasured:true as const,maximumCallbackGapMs:clock.maximumCallbackGapMs,frameMs:clock.frameMs,
  endToAsrSubmitMs:interval(row.asr?.submittedAt),endToAsrFinishedMs:interval(row.asr?.finishedAt),endToReplyRecordedMs:interval(row.replyRecordedAt),
  endToUtilityCompleteMs:actualUtility?interval(row.utility?.completedAt):undefined,
  endToFullReplyPlaybackMs:fullReply?interval(row.tts?.playbackStartedAt):undefined,
  endToFullReplyEndedMs:fullReply?interval(row.tts?.endedAt):undefined,
  correctnessHumanReviewed:row.humanApproved===true,outputDeviceLatencyUnmeasured:true as const}
}
