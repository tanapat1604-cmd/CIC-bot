export const ASSISTANT_GUIDES_EN={
 ocr:'OCR reads text from an image. Choose an image on the OCR page, then review the extracted text before using it. The selected image is processed locally.',
 screen:'Choose a window to share on the Screen page first. CiC cannot see an unshared screen. It can read text locally from the window you select.',
 slides:'Prepare the topic and content on the Slides page. Review the draft before creating a local PPTX or PDF. This reply has not created a file.',
 apps:'CiC can prepare opening Notepad, Chrome and YouTube after one scoped consent during app use. Name the app you want. Playing a specific song still needs further validation.',
 memory:'CiC has short conversation context and temporary tool-selection memory. It does not currently store personal preferences or habits across days.',
 voice:'Click Start to permit the microphone yourself. Speech is recognized locally; Stop ends your microphone and owned jobs. Accurate human speech and a 1–2 second response are still unverified.',
 calculator:'Give an expression, for example /calc (12-3)*4. CiC uses the local calculator for the numeric answer instead of asking AI to guess it.',
 research:'Tell CiC what public information to search for. It prepares public search and reading in Chrome under your scoped consent.',
} as const
export function englishKnowledgeReply(text:string):string|null{
 // HOW/WHAT questions are explanations, not an instruction or app consent.
 if(!/^(?:what\b|how\b|explain\b|(?:can|do)\s+(?:you|cic)\s+(?:remember|see|hear)\b)/iu.test(text))return null
 const self=/\b(?:cic|you|your|bot|assistant|me|my|i)\b/iu.test(text)
 if(self&&/(?:preferences|habits|personal memory|persistent|across days|long.term memory|remember.+(?:about me|my))/iu.test(text))return ASSISTANT_GUIDES_EN.memory
 if(/\bocr\b/iu.test(text)||self&&/\b(?:image|picture|photo)\b/iu.test(text)&&/\b(?:read|extract|text|work|use)\b/iu.test(text))return ASSISTANT_GUIDES_EN.ocr
 if(self&&/\b(?:screen|share a window|window sharing)\b/iu.test(text))return ASSISTANT_GUIDES_EN.screen
 if(self&&/\b(?:slides|presentation|pptx)\b/iu.test(text))return ASSISTANT_GUIDES_EN.slides
 if(self&&/\b(?:notepad|chrome|youtube|open apps|open programs)\b/iu.test(text))return ASSISTANT_GUIDES_EN.apps
 if(self&&/\b(?:microphone|mic|voice|speech|hear)\b/iu.test(text))return ASSISTANT_GUIDES_EN.voice
 if(self&&/\b(?:calculator|calculate|calc)\b/iu.test(text))return ASSISTANT_GUIDES_EN.calculator
 if(self&&/\b(?:search|web|research)\b/iu.test(text))return ASSISTANT_GUIDES_EN.research
 if(self&&/\bwhat can\b.+\bdo\b/iu.test(text))return 'CiC can choose local tools, calculate, tell the time, and prepare supported apps after scoped consent. It can guide you to OCR, selected-window sharing and slide creation.'
 return null
}
