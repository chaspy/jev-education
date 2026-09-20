"""Extract CC BY 4.0 statements. Authored skill names/edges are kept separate."""
import gzip,re,json,hashlib,urllib.request
from pathlib import Path
url='https://w3id.org/jp-cos/cs-items-20220830.ttl.gz'
blob=urllib.request.urlopen(url).read();text=gzip.decompress(blob).decode();items={}
for m in re.finditer(r'<https://w3id.org/jp-cos/(8[234]5[^>]+)> a <https://w3id.org/jp-cos/Item>;(.+?)(?=\n\n)',text,re.S):
 t=re.search("schema:description '''(.*?)'''",m[2],re.S)
 if t:items[m[1]]=t[1]
specs=json.loads(Path('scripts/adaptive-sim/skills.json').read_text());nodes=[]
for i,(id,grade,name,domain,parents,code) in enumerate(specs):
 nodes.append({'id':id,'grade':grade,'name':name,'domain':domain,'parents':parents,'lane':i%3,'releaseWeek':(grade-1)*52,'source':{'code':code,'url':f'https://jp-cos.github.io/{code[:3]}/{code[3:]}','text':items[code]}})
data={'attribution':'学習指導要領LOD（元資料：文部科学省）','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','retrievedAt':'2026-09-20','source':url,'sourceSha256':hashlib.sha256(blob).hexdigest(),'modifications':'36技能に関連する項目を抽出。技能名・前提関係・高校の学年配置は独自編集。全単元の網羅ではない。','nodes':nodes}
Path('apps/adaptive-sim/public/curriculum.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
for n in nodes:print(n['id'],n['source']['text'][:100].replace('\n',' '))
