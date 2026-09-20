"""Probe upstream validators only; no model inference, no remote API calls."""
import importlib.util,json,sys
from pathlib import Path
root=Path(sys.argv[1]);out=Path(sys.argv[2])
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);sys.modules[name]=m;spec.loader.exec_module(m);return m
kev=module('kev_api',root/'kev/kev/api.py')
nimble=module('nimble_schema',root/'nimble/nimble/scoring/parallel_schema.py')
diffusion=module('diffusion_server',root/'diffusion/structured_server.py')
request=json.loads(Path('research/jev-clones/laya-smoke.json').read_text())['request']
results=[]
def probe(name,fn):
 try:fn();results.append({'test':name,'accepted':True})
 except (ValueError,TypeError,KeyError) as e:results.append({'test':name,'accepted':False,'error':str(e)})
probe('kev: Jev request with all 3 primitives',lambda:kev.SystemOneRequest.model_validate(request))
probe('diffusion: Jev request with all 3 primitives',lambda:diffusion.jev_schema(request))
probe('nimble: unchanged Jev questions',lambda:nimble.validate_schema(request['questions']))
converted={'fits':{'type':'boolean','description':request['questions']['fits']['instructions']},'subject':{'type':'enum','description':'教科','choices':['math','english','history'],'choice_descriptions':request['questions']['subject']['criteria']},'difficulty':{'type':'enum','description':'式変形の段階数','choices':['0','1','2'],'choice_descriptions':dict(enumerate(request['questions']['difficulty']['criteria']))}}
converted['difficulty']['choice_descriptions']={str(k):v for k,v in converted['difficulty']['choice_descriptions'].items()}
probe('nimble: explicitly converted schema',lambda:nimble.validate_schema(converted))
large={'state':'example','model':'jev-latest','questions':{'cause':{'type':'choice','instructions':'Select a cause.','criteria':{str(i):f'Cause {i}' for i in range(55)}}}}
probe('kev: previous 55-label task shape',lambda:kev.SystemOneRequest.model_validate(large))
probe('diffusion: previous 55-label task shape',lambda:diffusion.jev_schema(large))
probe('nimble: converted 55-label task',lambda:nimble.validate_schema({'cause':{'type':'enum','description':'Cause','choices':list(large['questions']['cause']['criteria'])}}))
result={'scope':'schema validation only, NOT inference or full SDK compatibility','results':results,'nimble_converted_example':converted}
out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2))
