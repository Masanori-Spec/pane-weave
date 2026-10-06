import {validateManifest,assemble} from './engine.mjs';
import {zipSync,strToU8} from 'fflate';
export function validateWorkspace(text){const model=validateManifest(text);assemble(model,model.projects.map(p=>p.id));const clean={schema:1,modules:model.modules.map(({id,kdl})=>({id,kdl})),projects:model.projects.map(({id,modules,kdl})=>({id,modules,kdl}))};if(new TextEncoder().encode(JSON.stringify(clean,null,2)+'\n').length>1048576)throw Error('input-byte-limit');return clean;}
export function editModule(workspace,id,text){if(typeof text!=='string')throw Error('invalid-kdl-text');const next=structuredClone(workspace),module=next.modules.find(m=>m.id===id);if(!module)throw Error('unknown-module');module.kdl=text;return validateWorkspace(JSON.stringify(next));}
export {editorView,fromEditor} from './editor.mjs';
function declarations(model,projects){
 const moduleIds=new Set(projects.flatMap(p=>p.modules)),rows=[];
 const add=row=>{if(rows.length>=2048)throw Error('review-row-limit');rows.push(row);};
 const walk=(node,origin,path)=>{const here=[...path,node.name],p=node.props;
  for(const key of ['command','cwd','edit','location'])if(Object.hasOwn(p,key))add({origin,node:here.join('/'),field:key,value:p[key]});
  if(['command','cwd','edit','args'].includes(node.name))add({origin,node:here.join('/'),field:node.name,value:node.values});
  for(const child of node.children)walk(child,origin,here);
 };
 for(const m of model.modules)if(moduleIds.has(m.id))for(const d of m.definitions)walk(d.node,`module:${m.id}`,[]);
 for(const p of projects)for(const n of p.nodes)walk(n,`project:${p.id}`,[]);
 return rows;
}
export function review(workspace,ids,previous={}){const model=validateManifest(JSON.stringify(workspace));const outputs=assemble(model,ids),projects=model.projects.filter(p=>ids.includes(p.id)),required=new Set(projects.flatMap(p=>p.modules));const projected={schema:1,modules:workspace.modules.filter(m=>required.has(m.id)),projects:workspace.projects.filter(p=>ids.includes(p.id))};const effects=outputs.map(o=>({project:o.project,status:!Object.hasOwn(previous,o.project)?'new':previous[o.project]===o.kdl?'unchanged':'changed'}));return {outputs,projected,effects,declarations:declarations(model,projects),warning:'Text-only assembly and conflict checks. Native acceptance is proven for the published synthetic fixture only. Loading a layout in Zellij can execute commands and load plugins; command, directory and plugin behavior is not verified.'};}
export function reviewZip(result){const files={};for(const o of result.outputs)files['layouts/'+o.fileName]=o.kdl;files['inputs/selected-workspace.json']=JSON.stringify(result.projected,null,2)+'\n';files['review.json']=JSON.stringify({effects:result.effects,declarations:result.declarations,sourceMaps:result.outputs.map(o=>({project:o.project,sourceMap:o.sourceMap})),warning:result.warning},null,2)+'\n';files['README.txt']='PaneWeave review bundle\n\nOrdinary KDL files are under layouts/. Only selected projects and required modules are included. Original source bytes are retained inside their output blocks. The source map uses UTF-8 byte offsets (exclusive end) and KDL newline-aware line numbers.\n\n'+result.warning+'\nNo commands were run and no configuration was installed. Review each file before using it in Zellij.\n';if(strToU8(files['review.json']).length>8*1048576)throw Error('report-byte-limit');let total=0;const encoded=Object.fromEntries(Object.entries(files).map(([name,text])=>{const data=strToU8(text);total+=data.length;if(total>12*1048576)throw Error('zip-byte-limit');return [name,[data,{mtime:new Date('2020-01-01T00:00:00Z')}]];}));return zipSync(encoded,{level:6});}
