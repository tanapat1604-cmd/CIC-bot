type StorageLike=Pick<Storage,'getItem'|'setItem'>
export type SpeechPreference={live:boolean;language:'th-TH'|'en-US'}
const key='cicSpeechPreferenceV1'
export function readSpeechPreference(storage?:StorageLike):SpeechPreference{try{const source=storage??localStorage,value=JSON.parse(source.getItem(key)??'null');return{live:value?.live===true,language:value?.language==='en-US'?'en-US':'th-TH'}}catch{return{live:false,language:'th-TH'}}}
export function saveSpeechPreference(value:SpeechPreference,storage?:StorageLike){try{(storage??localStorage).setItem(key,JSON.stringify({live:value.live===true,language:value.language==='en-US'?'en-US':'th-TH'}))}catch{/* Preferences remain available for this page when storage is unavailable. */}}
