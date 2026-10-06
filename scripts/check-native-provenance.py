"""Read only Cargo-downloaded upstream sources; upload metadata, never code/binaries."""
import json,hashlib,pathlib,subprocess,tomllib,shutil
root=pathlib.Path(__file__).resolve().parent.parent
metadata=json.loads(subprocess.check_output(['cargo','+1.98.1','metadata','--locked','--manifest-path',str(root/'native/Cargo.toml'),'--format-version','1']))
pin=json.loads((root/'scripts/upstream-pin.json').read_text());matches=[p for p in metadata['packages'] if p['name']=='zellij-utils'];assert len(matches)==1
package=matches[0];assert package['version']==pin['version'] and package['license']=='MIT';source=pathlib.Path(package['manifest_path']).parent
vcs=json.loads((source/'.cargo_vcs_info.json').read_text());assert vcs['git']['sha1']==pin['commit'] and not vcs['git'].get('dirty',False),vcs
verified=[]
for item in pin['source_files']:
 local=source/pathlib.Path(item['path']).relative_to('zellij-utils');data=local.read_bytes();blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest();assert blob==item['git_blob_sha'] and len(data)==item['bytes'];verified.append({**item,'sha256':hashlib.sha256(data).hexdigest()})
lock_path=root/'native/Cargo.lock';lock=tomllib.loads(lock_path.read_text());checksums={(p['name'],p['version']):p.get('checksum') for p in lock['package']}
packages=[{'name':p['name'],'version':p['version'],'license':p.get('license'),'source':p.get('source'),'checksum':checksums.get((p['name'],p['version']))} for p in metadata['packages'] if p['name']!='pane_weave_native_probe']
report={'crate':'zellij-utils','version':pin['version'],'git_commit_verified':vcs['git']['sha1'],'license':package['license'],'source_files':verified,'native_lock_sha256':hashlib.sha256(lock_path.read_bytes()).hexdigest(),'compiled_dependency_metadata':packages,'distribution':'Only original probe/assembler source, fixture KDL, pin/lock/provenance metadata. No registry source or binary is uploaded.'}
(root/'evidence').mkdir(exist_ok=True);(root/'evidence/native-provenance.json').write_text(json.dumps(report,indent=2)+'\n');shutil.copyfile(lock_path,root/'evidence/native-Cargo.lock');print(json.dumps({'verified_core':pin['version'],'commit':pin['commit'],'source_files':len(verified),'dependencies':len(packages)},indent=2))
