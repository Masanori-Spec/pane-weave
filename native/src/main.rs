use std::{fs,path::{Path,PathBuf}};
use zellij_utils::input::layout::{Layout,TiledPaneLayout,Run};
use serde_json::json;

fn parse(text:&str)->Result<Layout,String>{
    // No session, command runner, configuration lookup, plugin loader, or filename.
    Layout::from_kdl(text,None,None,Some(PathBuf::from("/pane-weave-fixture-root")))
        .map_err(|e|format!("{e:?}"))
}
fn read_parse(path:&Path)->Layout{parse(&fs::read_to_string(path).unwrap()).unwrap_or_else(|e|panic!("Native parse failed for {}: {e}",path.display()))}
fn patch_tests(pane:&mut TiledPaneLayout)->usize{
    let mut count=0;
    if let Some(Run::Command(command))=&mut pane.run {
        if command.command==PathBuf::from("make") {
            assert_eq!(command.args,vec!["test".to_string()]);
            command.args.push("-race".to_string());count+=1;
        }
    }
    for child in &mut pane.children {count+=patch_tests(child);}
    count
}
fn main(){
    let args:Vec<String>=std::env::args().collect();
    let generated=PathBuf::from(args.get(1).map(String::as_str).unwrap_or("evidence/generated"));
    let references=Path::new("fixtures/references");
    let mut pairs=vec![];let mut changed_test_panes=0;
    for project in ["alpha","beta"] {
        let mut before=None;let mut after=None;
        for variant in ["before","after"] {
            let file=format!("{project}-{variant}.kdl");
            let actual=read_parse(&generated.join(&file));let expected=read_parse(&references.join(&file));
            assert_eq!(actual,expected,"Full native Layout mismatch: {file}");
            assert_eq!(actual.tabs.len(),if project=="alpha"{1}else{2});
            assert_eq!(actual.focused_tab_index,Some(if project=="alpha"{0}else{1}));
            pairs.push(json!({"file":file,"full_native_layout_equality":true,"native_layout":actual}));
            if variant=="before"{before=Some(actual)}else{after=Some(actual)};
        }
        let mut expected_change=before.unwrap();let actual_after=after.unwrap();let mut count=0;
        for (_,pane,_) in &mut expected_change.tabs {count+=patch_tests(pane);}
        assert_eq!(count,1,"Exactly one test command per project");
        assert_eq!(expected_change,actual_after,"Unexpected non-argument native change");changed_test_panes+=count;
    }
    assert_eq!(changed_test_panes,2);
    let mut parse_rejected=vec![];
    for name in ["cycle","duplicate","children","missing"] {
        let text=fs::read_to_string(format!("fixtures/negative/{name}.kdl")).unwrap();
        assert!(parse(&text).is_err(),"Native parser accepted invalid {name}");parse_rejected.push(name);
    }
    let alpha_text=fs::read_to_string(generated.join("alpha-before.kdl")).unwrap();let alpha=read_parse(&generated.join("alpha-before.kdl"));
    let bad_args=alpha_text.replace("args \"--clean\" \"notes with spaces.md\"","args \"--clean notes\" \"with spaces.md\"");
    assert_ne!(parse(&bad_args).unwrap(),alpha,"Argument boundary mutation not detected");
    let bad_cwd=alpha_text.replace("/work/alpha","/work/alpha-changed");
    assert_ne!(parse(&bad_cwd).unwrap(),alpha,"Cwd mutation not detected");
    let report=json!({"zellij_utils":"0.45.1","upstream_commit":"efd8fd5a89a20c07a111d248ad7fce53848d2c18","status":"full-native-layout-equality-passed","pairs":pairs,"changed_test_panes":changed_test_panes,"only_expected_argument_changes":true,"native_parse_controls_rejected":parse_rejected,"native_equality_controls_detected":["argument-boundary","cwd-change"],"sessions_started":0,"commands_executed":0,"plugins_loaded":0,"scope":"Unmodified pinned Layout::from_kdl parsing and expansion; no Zellij session or terminal rendering"});
    println!("{}",serde_json::to_string_pretty(&report).unwrap());
}
