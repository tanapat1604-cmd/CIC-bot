// Exact spoken arithmetic, never ASR correction. Unknown words stay unknown.
// Word operands are bounded to 0..999, with up to four spoken decimal digits.
export type SpokenArithmetic={kind:'complete';expression:string}|{kind:'missing';question:string;left?:string;right?:string;operator?:string;language:'th'|'en'}
const th=['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า']
const en=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen']
const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']
function thai(n:number):string{if(n<10)return th[n];if(n>=100)return th[Math.floor(n/100)]+'ร้อย'+(n%100===1?'เอ็ด':n%100?thai(n%100):'');const a=Math.floor(n/10),b=n%10;return(a===1?'':a===2?'ยี่':th[a])+'สิบ'+(b===1?'เอ็ด':b?th[b]:'')}
function english(n:number):string{if(n<20)return en[n];if(n>=100)return en[Math.floor(n/100)]+' hundred'+(n%100?' '+english(n%100):'');return tens[Math.floor(n/10)]+(n%10?' '+en[n%10]:'')}
const numbers=new Map<string,string>();for(let n=0;n<1000;n++){numbers.set(thai(n),String(n));numbers.set(english(n),String(n))}
export function spokenNumber(raw:string):string|null{
 let text=raw.normalize('NFC').trim().toLowerCase();if(!text||text.length>100)return null
 if(/^-?\d{1,10}(?:\.\d{1,4})?$/u.test(text))return text
 const negative=/^(?:ติดลบ|negative\s+)/u.test(text);text=text.replace(/^(?:ติดลบ|negative\s+)/u,'').trim()
 const isThai=/[\u0e00-\u0e7f]/u.test(text);text=isThai?text.replace(/\s+/gu,''):text.replace(/(?<=[a-z])-(?=[a-z])/gu,' ').replace(/\s+/gu,' ')
 const parts=text.split(isThai?'จุด':' point ');if(parts.length>2)return null
 const whole=numbers.get(parts[0]);if(whole===undefined)return null
 let decimal='';if(parts.length===2){const pieces=isThai?parts[1].match(/ศูนย์|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า/gu):parts[1].split(' ');if(!pieces||pieces.length<1||pieces.length>4||pieces.join(isThai?'':' ')!==parts[1])return null;for(const piece of pieces){const digit=(isThai?th:en.slice(0,10)).indexOf(piece);if(digit<0)return null;decimal+=digit}}
 return(negative?'-':'')+whole+(decimal?'.'+decimal:'')
}
const operators={'บวก':'+','ลบ':'-','คูณ':'*','หาร':'/','plus':'+','minus':'-','times':'*','multiplied by':'*','divided by':'/'} as const
export function spokenArithmetic(raw:string,allowNumber=false):SpokenArithmetic|null{
 let text=raw.normalize('NFC').trim();if(text.length>200||[...text].some(c=>c.charCodeAt(0)<32))return null
 const explicit=/^(?:คำนวณ|คิดเลข|calculate\b|compute\b)/iu.test(text);text=text.replace(/^(?:คำนวณ|คิดเลข|calculate\b|compute\b)\s*/iu,'').replace(/(?:\s*(?:ให้หน่อย|หน่อย|ครับ|ค่ะ)|\s+please|\s*\?)$/iu,'').trim()
 const language=/[\u0e00-\u0e7f]/u.test(text)?'th':'en'
 // A whole match prevents advice, quoted text, negations and extra actions
 // from becoming a numeric command. Arithmetic precedence is not inferred.
 const pattern=/(บวก|(?<!ติด)ลบ|คูณ|หาร|\bplus\b|\bminus\b|\btimes\b|\bmultiplied by\b|\bdivided by\b)/giu
 const matches=[...text.matchAll(pattern)]
 if(matches.length===1){const m=matches[0],left=spokenNumber(text.slice(0,m.index)),right=spokenNumber(text.slice(m.index!+m[0].length)),operator=operators[m[0].toLowerCase() as keyof typeof operators]
  if(left!==null&&right!==null)return{kind:'complete',expression:left+' '+operator+' '+right}
  if(left!==null&&!text.slice(m.index!+m[0].length).trim())return{kind:'missing',left,operator,language,question:language==='th'?'ต้องการ'+m[0]+' '+left+' กับจำนวนเท่าไรครับ?':'What number should I '+(operator==='+'?'add to':operator==='-'?'subtract from':operator==='*'?'multiply by':'divide into')+' '+left+'?'}
  if(right!==null&&!text.slice(0,m.index).trim())return{kind:'missing',right,operator,language,question:language==='th'?'จำนวนแรกที่จะ'+m[0]+'คือเท่าไรครับ?':'What is the first number?'}
 }
 if(matches.length>1){const operands=text.split(pattern).filter((_,i)=>i%2===0);if(operands.every(s=>spokenNumber(s)!==null))return{kind:'missing',language,question:language==='th'?'ต้องการคำนวณส่วนไหนก่อนครับ? ระบุสมการพร้อมวงเล็บได้เลย':'Which operation should happen first? Please give the expression with parentheses.'}}
 if((explicit||allowNumber)&&spokenNumber(text)!==null)return{kind:'missing',language,question:language==='th'?'ต้องการบวก ลบ คูณ หรือหาร กับจำนวนเท่าไรครับ?':'Which operation and second number should I use?'}
 return null
}
