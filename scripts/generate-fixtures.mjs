import fs from 'node:fs';import {build} from '../src/engine.mjs';
const frames=`pane_template name="topBar" size=1 borderless=true {
    plugin location="zellij:tab-bar"
}
pane_template name="bottomBar" size=1 borderless=true {
    plugin location="zellij:status-bar"
}
default_tab_template {
    topBar
    children
    bottomBar
}
`;
const tools=`pane_template name="editorPane" command="nvim" {
    args "--clean" "notes with spaces.md"
}
pane_template name="testPane" command="make" {
    args "test"
}
`;
const tabs=`tab_template name="devTab" {
    topBar
    children
    bottomBar
}
`;
const manifest={schema:1,modules:[{id:'frames',kdl:frames},{id:'tools',kdl:tools},{id:'tabs',kdl:tabs}],projects:[
{id:'alpha',modules:['frames','tools','tabs'],kdl:`devTab name="Dev" cwd="/work/alpha" focus=true {
    editorPane focus=true
    testPane
}
`},
{id:'beta',modules:['frames','tools'],kdl:`tab name="Review" cwd="/work/beta/docs" {
    editorPane focus=true
}
tab name="Test" cwd="/work/beta/service" focus=true {
    testPane focus=true
}
`}]};
fs.mkdirSync('evidence/generated',{recursive:true});fs.writeFileSync('fixtures/workspace.json',JSON.stringify(manifest,null,2)+'\n');
for(const variant of ['before','after']){const input=structuredClone(manifest);if(variant==='after')input.modules.find(m=>m.id==='tools').kdl=tools.replace('args "test"','args "test" "-race"');const outputs=build(JSON.stringify(input),['alpha','beta']);for(const output of outputs){fs.writeFileSync(`evidence/generated/${output.project}-${variant}.kdl`,output.kdl);fs.writeFileSync(`evidence/generated/${output.project}-${variant}-report.json`,JSON.stringify({sourceMap:output.sourceMap,report:output.report},null,2)+'\n');}}
console.log('Generated four ordinary KDL layouts and source maps; no commands run');
