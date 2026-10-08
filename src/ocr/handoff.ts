import type {OcrReference,OcrSource} from '../../shared/ocr'
export type ReviewedReference=OcrReference&{engine:string;edited:boolean;connection:'live'|'test';model?:string}
export type SelectedFrame={blob:Blob;source:OcrSource;capturedMono:number;originalWidth:number;originalHeight:number}
let reference:ReviewedReference|null=null,frame:SelectedFrame|null=null
export function offerReference(value:ReviewedReference){reference=value}
export function takeReference(){const value=reference;reference=null;return value}
export function offerFrame(value:SelectedFrame){if(performance.now()-value.capturedMono>=10000)return;frame=value;setTimeout(()=>{if(frame===value)frame=null},10000)}
export function takeFrame(){const value=frame;frame=null;return value&&performance.now()-value.capturedMono<10000?value:null}
