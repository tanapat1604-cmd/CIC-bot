import {requireMusicRequest} from '../../shared/youtube'
let reviewed:string|null=null
export function reviewMusicTranscript(value:string){const text=value.trim().replace(/^(?:เฮ้|เห้|hey)\s*(?:ซีไอซี|ซีไอ|ci\s*c?)\s*[,，:!]?\s*/iu,'').trim();if(!text||text.length>200)throw Error('invalid-model-plan');requireMusicRequest(text);return text}
export function stashReviewedMusic(text:string){reviewed=reviewMusicTranscript(text)}
export function peekReviewedMusic(){return reviewed}
export function takeReviewedMusic(){const text=reviewed;reviewed=null;return text}
