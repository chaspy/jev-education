"""Local smoke test; installs/models are external. This is not an accuracy benchmark."""
import argparse,json,time,statistics,socket
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('model',choices=['laya','jevlike']);p.add_argument('--output',required=True);a=p.parse_args()
request={'model':'jev-latest','state':{'goal':'分母をなくす操作を練習したい。','material':'x/2 + 3 = 7 の両辺に2を掛けると？'},'questions':{'fits':{'type':'noul','instructions':'教材は目的の操作を直接練習させますか？'},'subject':{'type':'choice','instructions':'この教材の教科は？','criteria':{'math':'数学','english':'英語','history':'歴史'}},'difficulty':{'type':'score','instructions':'式変形の段階数を評価してください。','criteria':['式変形なし','1回の式変形','複数回の式変形']}}}
import torch
torch.set_num_threads(4)
t0=time.perf_counter()
if a.model=='laya':
 import laya
 from huggingface_hub import snapshot_download
 model_path=snapshot_download('convaiinnovations/laya-multilingual',revision='052592a15d198d9ad47da779604259b10b47b7aa')
 agent=laya.load(model_path,device='mps')
 load_ms=(time.perf_counter()-t0)*1000
 # Once weights are loaded, disallow Python socket connections during inference.
 original_connect=socket.socket.connect
 def denied(*args,**kwargs): raise RuntimeError('Network disabled for smoke inference')
 socket.socket.connect=denied
 samples=[]
 for i in range(4):
  torch.mps.synchronize();start=time.perf_counter()
  answer=agent.predict(request['state'],request['questions'])
  torch.mps.synchronize();samples.append((time.perf_counter()-start)*1000)
 socket.socket.connect=original_connect
 from typesafe_sdk._schemas.models import SystemOneResponse
 SystemOneResponse.model_validate(answer)
 result={'model':'convaiinnovations/laya-multilingual','device':str(agent.device),'load_ms':load_ms,'request':request,'response':answer,'elapsed_ms':samples,'warm_median_ms':statistics.median(samples[1:]),'network_connect_blocked_during_inference':True,'note':'1 Japanese case, 3 question types; not accuracy evaluation'}
else:
 from jevlike.data import ByteCollator,synthetic_example
 from jevlike.model import TinyScorer
 torch.manual_seed(5)
 examples=[synthetic_example(1000+i) for i in range(32)]
 batch=ByteCollator(128,24)(examples);model=TinyScorer(width=32,rank=32,context_tokens=128)
 optimizer=torch.optim.Adam(model.parameters(),lr=.01)
 initial=float(torch.nn.functional.cross_entropy(model(batch),batch['labels']).detach())
 for _ in range(30):
  loss=torch.nn.functional.cross_entropy(model(batch),batch['labels']);optimizer.zero_grad(set_to_none=True);loss.backward();optimizer.step()
 final=float(torch.nn.functional.cross_entropy(model(batch),batch['labels']).detach())
 probs=model(batch).softmax(-1)
 assert final<initial*.6
 assert torch.allclose(probs.sum(-1),torch.ones(len(examples)),atol=1e-6)
 result={'model':'TinyScorer','device':'cpu','train_examples':32,'train_steps':30,'initial_loss':initial,'final_loss':final,'total_ms':(time.perf_counter()-t0)*1000,'input_example':vars(examples[0]),'probabilities_example':probs[0].detach().tolist(),'note':'Upstream synthetic train-on-batch smoke; NOT held-out generalization or pretrained language understanding'}
Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
