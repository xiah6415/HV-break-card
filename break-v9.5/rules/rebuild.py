"""Rebuild frozen data entirely from repository sources, without network access."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

HERE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');args=parser.parse_args()
steps=['shared-rules/build.py','shared-rules/verify.py','card-mapping/build.py','card-mapping/verify.py','card-mapping/contract_tests.py']
files={'cards.json':'BREAK-card-rule-mapping.json','shared-rules.json':'BREAK-shared-rules.json','schema.json':'BREAK-card-program-schema.json',
       'mapping-validation.json':'BREAK-card-mapping-validation.json','contract-validation.json':'BREAK-card-contract-validation.json',
       'permission-reference.json':'BREAK-permission-reference.json'}
with tempfile.TemporaryDirectory(prefix='break-rules-') as directory:
 root=Path(directory);shutil.copytree(HERE/'source',root,dirs_exist_ok=True);(root/'outputs').mkdir(exist_ok=True)
 environment=dict(os.environ,PYTHONDONTWRITEBYTECODE='1')
 for step in steps:
  run=subprocess.run([sys.executable,str(root/'work'/step)],cwd=root,env=environment,text=True,capture_output=True)
  if run.returncode: raise RuntimeError(step+'\n'+run.stdout+run.stderr)
 data={name:(root/'outputs'/source).read_bytes() for name,source in files.items()}
 manifest=dict(version=1,status='FROZEN_FIRST_PASS_NOT_LIVE_APPROVED',
   source_hashes={str(p.relative_to(HERE)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((HERE/'source').rglob('*')) if p.is_file()},
   output_hashes={name:hashlib.sha256(value).hexdigest() for name,value in data.items()})
 data['manifest.json']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
 if args.write:
  (HERE/'data').mkdir(exist_ok=True)
  for name,value in data.items():(HERE/'data'/name).write_bytes(value)
 else:
  for name,value in data.items():
   if not (HERE/'data'/name).exists() or (HERE/'data'/name).read_bytes()!=value:raise RuntimeError('Data differs from rebuild: '+name)
 print(json.dumps(dict(rebuilt=True,files=len(data),write=args.write,source_files=len(manifest['source_hashes']))))
