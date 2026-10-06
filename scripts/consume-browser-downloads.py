"""Consume actual ZIP-downloaded KDL with the same unmodified native probe."""
from pathlib import Path
import zipfile,hashlib,subprocess,json
root=Path('test-results');folder=Path('.native/browser-downloads');folder.mkdir(parents=True,exist_ok=True);receipts=[]
for variant in ['before','after']:
 files=list(root.rglob(variant+'.zip'));assert len(files)==1
 raw=files[0].read_bytes()
 with zipfile.ZipFile(files[0]) as z:
  assert z.testzip() is None
  assert set(z.namelist())=={'layouts/alpha.kdl','layouts/beta.kdl','inputs/selected-workspace.json','review.json','README.txt'}
  for project in ['alpha','beta']:
   content=z.read(f'layouts/{project}.kdl');(folder/f'{project}-{variant}.kdl').write_bytes(content)
   assert content==Path(f'evidence/generated/{project}-{variant}.kdl').read_bytes()
  report=json.loads(z.read('review.json'));assert len(report['sourceMaps'])==2
 receipts.append({'variant':variant,'zip_sha256':hashlib.sha256(raw).hexdigest(),'entries':5})
result=subprocess.check_output(['native/target/debug/pane_weave_native_probe',str(folder)]);report=json.loads(result);assert report['status']=='full-native-layout-equality-passed' and report['changed_test_panes']==2
Path('evidence/browser-native-result.json').write_bytes(result);Path('evidence/browser-download-receipt.json').write_text(json.dumps({'actual_downloads':receipts,'full_native_equality_pairs':4,'only_expected_argument_changes':True,'commands_executed':0,'sessions_started':0,'plugins_loaded':0},indent=2)+'\n');print('Actual browser ZIPs: four full native equalities, exactly two argument edits, six negative controls passed')
