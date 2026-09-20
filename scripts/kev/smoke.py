"""Exercise the running local server with the official SDK; no hosted API calls."""
import json,time,statistics
from pathlib import Path
from typesafe_sdk import TypeSafeClient,Choice,Noul,Score
state={'message':'I was charged twice. Please refund the duplicate payment.'}
questions={'topic':Choice(instructions='Which department should handle this?',criteria={'billing':'payments and refunds','technical':'bugs and outages','sales':'new purchases'}),'refund':Noul(instructions='Is the customer asking for a refund?'),'urgency':Score(instructions='How urgent is the request?',criteria=['no deadline mentioned','due this week','due today'])}
rows=[]
with TypeSafeClient(api_key='local',base_url='http://127.0.0.1:8009',model='kev-0.5b') as client:
 for _ in range(4):
  start=time.perf_counter();response=client.system_one(state=state,questions=questions)
  rows.append({'elapsedMs':(time.perf_counter()-start)*1000,'response':response.model_dump()})
assert rows[-1]['response']['answers']['topic']['choice']=='billing'
assert set(rows[-1]['response']['answers'])=={'topic','refund','urgency'}
result={'endpoint':'http://127.0.0.1:8009/v1/systemone','serverStartup':'scripts/kev/start.sh sets HF_HUB_OFFLINE=1, TRANSFORMERS_OFFLINE=1, HF_HUB_DISABLE_TELEMETRY=1','scope':'3 primitives via official SDK; library offline mode, not an OS egress audit','warmMedianMs':statistics.median(r['elapsedMs'] for r in rows[1:]),'rows':rows}
Path('research/jev-clones/kev-offline-smoke.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'warmMedianMs':result['warmMedianMs'],'topic':rows[-1]['response']['answers']['topic']['choice']}))
