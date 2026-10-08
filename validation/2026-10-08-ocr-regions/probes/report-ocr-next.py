import json,html,re,hashlib,statistics
from pathlib import Path
root=Path('output/2026-10-07-ocr-next');items=json.loads((root/'results.json').read_text(encoding='utf-8'));cases=json.loads((root/'manifest.json').read_text(encoding='utf-8'));case_by_id={c['id']:c for c in cases}
freeze=json.loads((root/'FREEZE.json').read_text());assert hashlib.sha256((root/'manifest.json').read_bytes()).hexdigest()==freeze['manifestHash']
for f,h in freeze['imageHashes'].items():assert hashlib.sha256((root/f).read_bytes()).hexdigest()==h
summary=[]
for item in items:
 case=case_by_id[item['id']];kind=item['id'].removeprefix(item['split']+'-');m=item['metric'];limit=2 if kind.startswith('en-') or kind=='numbers' else 5
 # This is acceptance scoring only. Expected text never enters preprocessing or OCR.
 critical=re.findall(r'\d[\d:,./%-]*',item['expected']);critical_ok=all(token in item['actual'] for token in critical)
 line_count_ok=len([x for x in item['actual'].splitlines() if x.strip()])>=len(case['lines'])
 gate=m['exact'] if kind in ['blank','columns','numbers'] else m['cer']<=limit and critical_ok and line_count_ok
 if kind=='blur':gate=None
 outside=sum(w['x']<0 or w['y']<0 or w['x']+w['width']>960.01 or w['y']+w['height']>420.01 for read in item['reads'] for w in read['words'])
 assert outside==0
 summary.append({'id':item['id'],'split':item['split'],'variant':item['variant'],'cerPercent':m['cer'],'gate':gate,'criticalTokensExact':critical_ok,'enoughOutputLines':line_count_ok,'orderDiagnostic':item['order'],'outsideImageBoxes':outside,'wallMs':item['ms'],'readerPeakSampleMiB':item['peakSampleMiB']})
(root/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
rows=[]
for case in cases:
 row='<section><h2>'+html.escape(case['id'])+'</h2><img src="'+case['file']+'" alt="Synthetic test image"><h3>Expected</h3><pre>'+html.escape(case['expected'])+'</pre><div class="columns">'
 for variant in ['baseline','candidate']:
  item=next(x for x in items if x['id']==case['id'] and x['variant']==variant);s=next(x for x in summary if x['id']==case['id'] and x['variant']==variant)
  row+='<article><h3>'+variant+'</h3><p>CER '+str(s['cerPercent'])+'% · gate '+str(s['gate'])+' · '+str(s['wallMs'])+' ms</p><pre>'+html.escape(item['actual'])+'</pre><p>Source: Tesseract fast. Manual language/regions; no model repairs.</p></article>'
 rows.append(row+'</div></section>')
(root/'report.html').write_text('<!doctype html><meta charset="utf-8"><title>CIC OCR explicit language/regions</title><style>body{font:16px system-ui;margin:24px;color:#172438;max-width:1100px}img{max-width:100%;border:1px solid #999}section{border-top:1px solid #aaa;margin-top:28px;padding-top:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere}.columns{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:700px){.columns{grid-template-columns:1fr}}</style><h1>OCR experiment: explicit languages and manual regions</h1><p>Developer experiment, not CIC screen control. 24 synthetic images frozen before OCR; 12 new-2 cases. Candidate is not general automatic layout detection. Blur is an unsupported stress category, not silently discarded.</p>'+''.join(rows),encoding='utf-8')
for split in ['development','new-2']:
 for variant in ['baseline','candidate']:
  s=[x for x in summary if x['split']==split and x['variant']==variant];print(split,variant,'gate',sum(x['gate'] is True for x in s),'/',sum(x['gate'] is not None for x in s),'blur separate', 'medianMs',statistics.median(x['wallMs'] for x in s),'maxReaderMiB',max(x['readerPeakSampleMiB'] for x in s))
