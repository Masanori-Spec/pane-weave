# PaneWeave

A bounded, offline assembler for explicitly supplied Zellij KDL fragments. Named pane/tab templates and an optional default-tab frame are combined with each project's declared modules into ordinary standalone `layout { … }` files. Original fragment text, command argument boundaries, and cwd strings are preserved in the output; source maps identify their origin.

A self-contained Japanese/English browser workbench is included in `dist/paneweave.html`. Open it directly in a modern browser; no server, account, installation, internet, or Zellij session is required. Blob Workers must be supported and permitted.

## Use the offline app

1. Inspect the synthetic example or import/paste an explicit workspace JSON
2. Choose a shared module, import a `.kdl` into that explicit slot or edit its text and apply it; use workspace JSON to change project/module assignments
3. Select projects, assemble, and review changed/unchanged/new KDL relative to each project's previous in-memory build
4. Inspect declared commands, arguments, cwd/plugin references and source maps; then download the review ZIP

ZIPs contain `layouts/<project>.kdl`, `inputs/selected-workspace.json`, `review.json`, and a warning README. Only selected projects and required modules are included. The separate **Save whole workspace** button deliberately saves all imported modules/projects. No original file is modified.

Raw KDL files must be valid UTF-8 without a leading BOM; malformed bytes are rejected rather than silently replaced or stripped. The editor preserves uniform LF/CRLF/CR endings. Mixed-ending modules remain readable and exportable; edit their escaped source in workspace JSON to preserve exact endings. Unapplied edits invalidate old output and block export. Failed imports keep the previous workspace/draft; superseded reads cannot overwrite newer work. Reloading clears all imported content.

保存した HTML を開くだけで使えます。共有モジュールを適用し、対象プロジェクトを選んで組み立てると、KDL の変更・宣言・出典を確認して ZIP に保存できます。Zellij の起動や設定の書き込みは行いません。

The real native fixture gate has passed. The newly added UI/actual-browser-download gate is **pending CI verification**; local checks alone do not establish browser success.

## Boundary

The assembler treats everything as text. It never starts Zellij, attaches a session, runs commands, loads plugins, reads a real user configuration, follows external includes, or installs a layout. **Loading exported KDL in Zellij later may execute its commands and load its referenced plugins.** Review that text before doing so.

This preserves KDL source bytes inside each block, not literal runtime paths after Zellij's own expansion. Zellij may expand variables and tildes and compose cwd values when it consumes a layout. The native fixture uses only literal synthetic paths and passes an explicit synthetic global cwd, with no layout filename or external swap file.

## Manifest

`fixtures/workspace.json` is the explicit input:

- `modules`: unique IDs and KDL text containing only `pane_template`, `tab_template`, or `default_tab_template` definitions
- `projects`: unique IDs, an ordered list of module IDs, and KDL text containing tabs or named tab-template calls
- `schema`: `1`

No imports or module discovery occur. Missing modules/templates, conflicting names, duplicate defaults/properties, cycles, invalid placement, malformed placeholders, and unsupported syntax are blocked. Two alternatives may define the same name if they are never selected together. Output follows each project's declared module order; it does not rewrite or inline those source blocks.

Supported features are pane/tab containers and named templates, one optional default-tab template, quoted command/argument/cwd/edit strings, sizes, split direction, focus, borderless panes, start/close flags, stacks/expansion flags, and location-only plugin nodes. Floating/swap/new-tab layouts, external includes, `contents_file`, annotations, and arbitrary plugin configuration are outside this release. Tab templates require one explicit `children` placeholder. Put `size` on pane-template uses, not definitions: the pinned native parser rejects the ambiguous sized bar-template form tested in the first gate. Native validation for arbitrary user exports is not performed by the JavaScript assembler.

The parser is `@bgotink/kdl` **0.4.0**, using only its explicit KDL v1 parser. Its formatter is never used, so its v1-to-v2 formatting metadata does not change exported KDL syntax. Duplicate entries remain observable and are rejected.

Bounds: 1 MiB complete JSON input and normalized workspace, 16 modules, 16 projects, 64 total definitions, 4,096 parsed nodes per fragment, depth 24, a conservative 8,192-node expansion estimate per exported project, 32 arguments per `args` node, 4 MiB total assembled KDL, 2,048 declaration rows, 8 MiB review JSON, and 12 MiB total ZIP content before compression. A disposable Worker has an eight-second deadline. Source-map ranges include exclusive UTF-8 byte offsets and one-based lines, counting CRLF/CR/LF/NEL/U+2028/U+2029 without rewriting any original bytes.

## Native-first test

The probe depends directly on unmodified **zellij-utils = 0.45.1**, pinned to upstream commit [`efd8fd5a89a20c07a111d248ad7fce53848d2c18`](https://github.com/zellij-org/zellij/tree/efd8fd5a89a20c07a111d248ad7fce53848d2c18). `scripts/check-native-provenance.py` checks the Cargo package's clean VCS identity and every pinned file under `zellij-utils/src`, then retains the resolved lock and dependency license/checksum metadata.

The actual [`Layout::from_kdl`](https://github.com/zellij-org/zellij/blob/efd8fd5a89a20c07a111d248ad7fce53848d2c18/zellij-utils/src/kdl/mod.rs) parses four generated files. Its complete `Layout` objects must equal independently hand-written references, including default/new-tab template and swap fields. No handwritten replacement structs or normalization of the comparison is used. The references expand all custom names into ordinary panes/tabs and independently state the default frame, because the native `Layout.template` is part of full equality.

Alpha has one Dev tab with an editor and a test command. Beta has two tabs with distinct cwd/focus settings. A single shared edit from `args "test"` to `args "test" "-race"` must change exactly two native test-command argument vectors; a cloned before-layout with only those edits must equal the full after-layout. Native invalid duplicate/missing/cyclic/children fixtures must fail parsing. Argument-boundary and cwd mutations must fail the native equality oracle.

[The corrected native run](https://github.com/Masanori-Spec/pane-weave/actions/runs/37454368847) passed on exact commit `1d80783bd9081d281ea8eda0d91e66c0cc9c226e`: 27 source checks, all four complete native Layout equalities, exactly two expected argument-vector edits, four parser-rejection controls and two equality-corruption controls. The actual crate's clean commit and all 212 upstream source files were verified, with 283 resolved dependencies locked. This proves fixture parsing/expansion, not terminal rendering, sessions, command success, directories or plugins.

[The first run](https://github.com/Masanori-Spec/pane-weave/actions/runs/37452441547) had compiled the real crate but rejected `size` on a bar-template definition. Sizes were moved to uses; the independently written references and full-equality oracle were not weakened. The current bounded assembler rejects definition-level sizes explicitly.

The UI workflow now opens the actual offline HTML under sandboxed Chromium on Ubuntu 22.04 with browser networking disabled, downloads real before/after ZIPs, extracts the four actual KDL files, and passes them through the **same pinned native probe and unchanged references**. It checks JA/EN, keyboard scope, inert HTML-looking strings, stale imports, invalid UTF-8, repeated imports/downloads, pending-edit guards, line endings, mobile/enlarged text, and Worker failure. This new browser stage is pending; [current runs](https://github.com/Masanori-Spec/pane-weave/actions/workflows/native-gate.yml) show its outcome.

UI change labels compare exported KDL text, including unused definitions. They do not claim a resolved native semantic diff for arbitrary user layouts. The declaration table shows source fields before inheritance or environment expansion.

## Reproduce source checks

```sh
npm ci
npm run verify
```

With Rust 1.98.1 and Python 3.12 available, the separate native gate is:

```sh
python scripts/check-native-provenance.py
cargo +1.98.1 run --locked --manifest-path native/Cargo.toml
```

The native probe reads synthetic fixture files only. Cargo downloads are test dependencies, excluded from source/offline deliverables. CI uploads verification records, the offline HTML, actual browser downloads/screenshots, and the browser report; it excludes compilers, registry source, target directories, embedded Zellij plugin assets, and native binaries. Browser reproduction additionally requires the workflow's Playwright Chromium setup; there is no local-browser security bypass.

## Prior work and licensing

[Zellij #2696](https://github.com/zellij-org/zellij/issues/2696) and [#3835](https://github.com/zellij-org/zellij/issues/3835) discuss reusable panes/layout fragments. Native [pane/tab templates](https://zellij.dev/documentation/creating-a-layout.html) and [plugin aliases](https://zellij.dev/documentation/plugin-aliases) already solve important reuse problems. [Zellaygen](https://github.com/Axect/Zellaygen), [zellij-layout-generator](https://github.com/BernardIgiri/zellij-layout-generator), and [zellij-workspace](https://github.com/vdbulcke/zellij-workspace) are existing generators/workspace tools. The narrow workflow explored here is multiple explicit fragments, conflict checks, per-project assembly, and source maps. Demand, novelty, adoption, and commercial viability remain unvalidated. No new template engine or unique algorithm is claimed.

No license grant is made for original PaneWeave code. Dependency notices are scoped in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). The offline HTML bundles only the pinned MIT JavaScript parser and fflate ZIP implementation with their complete notices embedded. No native registry source/binaries, fonts, Zellij plugin assets, WASM, caches, credentials, or user configuration is shipped.
