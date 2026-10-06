import {parse as parseV1} from '@bgotink/kdl/v1-compat';
export const LIMITS=Object.freeze({bytes:1048576,modules:16,projects:16,templates:64,nodes:4096,depth:24,expanded:8192,outputBytes:4*1048576});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=code=>{throw new Error(code);};
const id=v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v);
const bytes=s=>new TextEncoder().encode(s).length;
const newlines=s=>(s.match(/\r\n|[\n\r\u0085\u2028\u2029]/g)||[]).length;
const definitions=new Set(['pane_template','tab_template','default_tab_template']);
const paneProperties=new Set(['command','cwd','edit','name','size','split_direction','focus','borderless','close_on_exit','start_suspended','stacked','expanded','exclude_from_sync']);
const tabProperties=new Set(['name','cwd','split_direction','focus','hide_floating_panes']);
const stringProperties=new Set(['command','cwd','edit','name','split_direction']);
const boolProperties=new Set(['focus','borderless','close_on_exit','start_suspended','stacked','expanded','exclude_from_sync','hide_floating_panes']);
const reserved=new Set([...definitions,...paneProperties,...tabProperties,'layout','pane','tab','children','args','plugin','location','new_tab_template','floating_panes','swap_tiled_layout','swap_floating_layout','contents_file','include']);
function safeString(v){return typeof v==='string'&&v.length<=4096&&v.isWellFormed()&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);}
function ast(text){
 if(typeof text!=='string'||!text.isWellFormed()||bytes(text)>LIMITS.bytes||/[\u0000\u000b\u000c]/.test(text))fail('invalid-kdl-text');
 let document;try{document=parseV1(text);}catch{fail('invalid-kdl-syntax');}
 let count=0;
 const convert=(node,depth)=>{
  if(++count>LIMITS.nodes||depth>LIMITS.depth)fail('kdl-complexity-limit');
  const name=node.getName();if(!id(name)||node.tag)fail('unsupported-kdl-node');
  const props=Object.create(null),values=[];
  for(const entry of node.entries){if(entry.value.tag)fail('unsupported-kdl-tag');const key=entry.getName(),value=entry.getValue();
   if(!(safeString(value)||typeof value==='boolean'||(Number.isSafeInteger(value)&&value>=0)))fail('unsupported-kdl-value');
   if(key===null)values.push(value);else{if(!id(key)||Object.hasOwn(props,key))fail('duplicate-or-invalid-property');props[key]=value;}}
  return {name,props,values,children:(node.children?.nodes??[]).map(n=>convert(n,depth+1))};
 };
 return document.nodes.map(n=>convert(n,0));
}
function propertyType(key,value){
 if(stringProperties.has(key)){if(!safeString(value)||value.length===0)fail('invalid-property-type');if(key==='split_direction'&&!['horizontal','vertical'].includes(value))fail('invalid-split-direction');}
 else if(boolProperties.has(key)){if(typeof value!=='boolean')fail('invalid-property-type');}
 else if(key==='size'){if(!(Number.isSafeInteger(value)&&value>=1&&value<=10000)&&!(typeof value==='string'&&/^(?:[1-9][0-9]?|100)%$/.test(value)))fail('invalid-size');}
 else fail('unsupported-property');
}
function validateNode(node,context,refs,inTemplate=false){
 const {name,props,values,children}=node;
 if(name==='children'){if(!inTemplate||values.length||Object.keys(props).length||children.length)fail('invalid-children-placeholder');return;}
 if(name==='plugin'){if(context!=='pane'||values.length||children.length||Object.keys(props).length!==1||!safeString(props.location)||!props.location.length)fail('unsupported-plugin-shape');return;}
 if(name==='args'){if(context!=='pane'||!values.every(safeString)||!values.length||values.length>32||Object.keys(props).length||children.length)fail('invalid-args');return;}
 if(paneProperties.has(name)&&name!=='name'){
  if(context!=='pane'||values.length!==1||Object.keys(props).length||children.length)fail('invalid-child-property');propertyType(name,values[0]);return;
 }
 if(name==='name'&&context==='pane'){if(values.length!==1||Object.keys(props).length||children.length)fail('invalid-child-property');propertyType(name,values[0]);return;}
 if(definitions.has(name)&&context!=='definition'||name==='tab'&&context!=='project')fail('invalid-node-position');
 const kind=name==='pane'||name==='pane_template'?'pane':name==='tab'||name==='tab_template'||name==='default_tab_template'?'tab':null;
 if(!kind){if(reserved.has(name))fail('unsupported-node');refs.push({name,expected:context==='project'?'tab_template':'pane_template'});}
 if(values.length)fail('unexpected-positional-values');
 const effectiveKind=kind??(context==='project'?'tab':'pane');
 const allowed=effectiveKind==='tab'?tabProperties:paneProperties;
 for(const [key,value] of Object.entries(props)){if(!allowed.has(key))fail('unsupported-property');propertyType(key,value);}
 const seen=new Set(Object.keys(props));
 for(const child of children){if(paneProperties.has(child.name)||child.name==='args'||child.name==='plugin'){if(seen.has(child.name))fail('duplicate-property-or-child');seen.add(child.name);}validateNode(child,effectiveKind,refs,inTemplate);}
}
function nodeCount(nodes){return nodes.reduce((n,x)=>n+1+nodeCount(x.children),0);}
function countChildren(nodes){return nodes.reduce((n,x)=>n+(x.name==='children'?1:0)+countChildren(x.children),0);}
function analyzeModule(module){
 const nodes=ast(module.kdl),defs=[];
 if(!nodes.length)fail('empty-module');
 for(const node of nodes){
  if(!definitions.has(node.name))fail('module-must-contain-only-definitions');
  if(node.name==='pane_template'&&(Object.hasOwn(node.props,'size')||node.children.some(c=>c.name==='size')))fail('template-size-must-be-on-use');
  const name=node.name==='default_tab_template'?'$default':node.props.name;
  if(name!=='$default'&&(!id(name)||reserved.has(name)))fail('invalid-template-name');
  if(node.name==='default_tab_template'&&Object.hasOwn(node.props,'name'))fail('named-default-not-supported');
  const refs=[];validateNode(node,'definition',refs,true);const placeholders=countChildren(node.children);if(placeholders>1)fail('multiple-children-placeholders');if(node.name!=='pane_template'&&placeholders!==1)fail('tab-template-needs-children');
  defs.push({name,kind:node.name,refs:[...refs],node,module:module.id});
 }
 return {id:module.id,kdl:module.kdl,definitions:defs};
}
export function validateManifest(text){
 if(typeof text!=='string'||bytes(text)>LIMITS.bytes)fail('input-byte-limit');
 let input;try{input=JSON.parse(text);}catch{fail('invalid-json');}
 if(!object(input)||input.schema!==1||Object.keys(input).some(k=>!['schema','modules','projects'].includes(k))||!Array.isArray(input.modules)||!Array.isArray(input.projects))fail('invalid-manifest');
 if(!input.modules.length||input.modules.length>LIMITS.modules||!input.projects.length||input.projects.length>LIMITS.projects)fail('manifest-count-limit');
 const moduleIds=new Set(),projectIds=new Set();
 const modules=input.modules.map(m=>{if(!object(m)||Object.keys(m).some(k=>!['id','kdl'].includes(k))||!id(m.id)||moduleIds.has(m.id)||typeof m.kdl!=='string')fail('invalid-or-duplicate-module');moduleIds.add(m.id);return analyzeModule(m);});
 if(modules.reduce((n,m)=>n+m.definitions.length,0)>LIMITS.templates)fail('template-count-limit');
 const projects=input.projects.map(p=>{
  if(!object(p)||Object.keys(p).some(k=>!['id','modules','kdl'].includes(k))||!id(p.id)||projectIds.has(p.id)||!Array.isArray(p.modules)||!p.modules.length||p.modules.length>LIMITS.modules||new Set(p.modules).size!==p.modules.length||!p.modules.every(id)||typeof p.kdl!=='string')fail('invalid-or-duplicate-project');projectIds.add(p.id);
  const nodes=ast(p.kdl),refs=[];if(!nodes.length)fail('empty-project');for(const n of nodes){if(definitions.has(n.name)||n.name==='layout'||n.name==='pane'||reserved.has(n.name)&&n.name!=='tab')fail('project-must-contain-tabs');validateNode(n,'project',refs);}
  return {id:p.id,modules:p.modules,kdl:p.kdl,nodes,refs:[...refs]};
 });
 return {schema:1,modules,projects};
}
function validateProject(model,project){
 const selected=project.modules.map(id=>{const m=model.modules.find(m=>m.id===id);if(!m)fail('missing-module');return m;});
 const defs=new Map();
 for(const m of selected)for(const d of m.definitions){if(defs.has(d.name))fail(d.name==='$default'?'duplicate-default-tab':'duplicate-template-name');defs.set(d.name,d);}
 const visiting=new Set(),done=new Map();
 function visit(name){if(done.has(name))return done.get(name);if(visiting.has(name))fail('template-cycle');const d=defs.get(name);if(!d)fail('missing-template');visiting.add(name);let cost=nodeCount([d.node]);for(const ref of d.refs){if(!defs.has(ref.name))fail('missing-template');if(defs.get(ref.name)?.kind!==ref.expected)fail('wrong-template-kind');cost+=visit(ref.name);}if(cost>LIMITS.expanded)fail('expanded-template-limit');visiting.delete(name);done.set(name,cost);return cost;}
 let definitionCost=0;for(const d of defs.values())definitionCost+=visit(d.name);if(definitionCost>LIMITS.expanded)fail('expanded-template-limit');
 for(const n of project.nodes){if(n.name!=='tab'&&defs.get(n.name)?.kind!=='tab_template')fail('missing-tab-template');}
 let projectCost=definitionCost+nodeCount(project.nodes);for(const node of project.nodes)if(node.name==='tab'&&defs.has('$default'))projectCost+=visit('$default');for(const ref of project.refs){if(!defs.has(ref.name))fail('missing-template');if(defs.get(ref.name).kind!==ref.expected)fail('wrong-template-kind');projectCost+=visit(ref.name);}if(projectCost>LIMITS.expanded)fail('expanded-template-limit');
 return {selected,defs};
}
export function assemble(model,projectIds){
 if(!Array.isArray(projectIds)||!projectIds.length||projectIds.length>LIMITS.projects||new Set(projectIds).size!==projectIds.length)fail('invalid-project-selection');
 const projects=projectIds.map(id=>{const p=model.projects.find(p=>p.id===id);if(!p)fail('unknown-project');return p;});let totalBytes=0;
 return projects.map(project=>{
  const {selected,defs}=validateProject(model,project);let text='// PaneWeave: review before loading; Zellij may run commands and load plugins.\nlayout {\n';const sourceMap=[];
  const append=(kind,id,raw)=>{text+=`// ${kind}: ${id}\n`;const startLine=newlines(text)+1,startByte=bytes(text);text+=raw;const endLine=startLine+newlines(raw),endByte=bytes(text);sourceMap.push({kind,id,startLine,endLine,startByte,endByte,originalText:raw});text+='\n';};
  for(const module of selected)append('module',module.id,module.kdl);append('project',project.id,project.kdl);text+='}\n';totalBytes+=bytes(text);if(totalBytes>LIMITS.outputBytes)fail('output-byte-limit');
  return {project:project.id,fileName:project.id+'.kdl',kdl:text,sourceMap,report:{modules:selected.map(m=>m.id),templates:[...defs.keys()],nativeValidation:'Not performed in this assembler. The native fixture gate is separate.',executionWarning:'Inert text here. Loading this layout in Zellij may execute commands and load plugin references.'}};
 });
}
export function build(text,projectIds){return assemble(validateManifest(text),projectIds);}
