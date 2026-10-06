# PaneWeave — native feasibility checkpoint

A bounded, offline assembler for explicitly supplied Zellij KDL fragments. Named pane/tab templates and an optional default-tab frame are combined with each project's declared modules into ordinary standalone `layout { … }` files. Original fragment text, command argument boundaries, and cwd strings are preserved in the output; source maps identify their origin.

**This is a source-only feasibility checkpoint.** JavaScript assembly checks pass. The first native CI compiled the real crate and verified provenance, then rejected a bar-template fixture. The corrected full equality gate remains pending. There is no UI and no claim of a completed product until that gate succeeds.

## Boundary

The assembler treats everything as text. It never starts Zellij, attaches a session, runs commands, loads plugins, reads a real user configuration, imports external files, or installs a layout. **Loading exported KDL in Zellij later may execute its commands and load its referenced plugins.** Review that text before doing so.

This preserves KDL source bytes inside each block, not literal runtime paths after Zellij's own expansion. Zellij may expand variables and tildes and compose cwd values when it consumes a layout. The native fixture uses only literal synthetic paths and passes an explicit synthetic global cwd, with no layout filename or external swap file.

## Manifest

`fixtures/workspace.json` is the explicit input:

- `modules`: unique IDs and KDL text containing only `pane_template`, `tab_template`, or `default_tab_template` definitions
- `projects`: unique IDs, an ordered list of module IDs, and KDL text containing tabs or named tab-template calls
- `schema`: `1`

No imports or module discovery occur. Missing modules/templates, conflicting names, duplicate defaults/properties, cycles, invalid placement, malformed placeholders, and unsupported syntax are blocked. Two alternatives may define the same name if they are never selected together. Output follows each project's declared module order; it does not rewrite or inline those source blocks.

Supported features are pane/tab containers and named templates, one optional default-tab template, quoted command/argument/cwd/edit strings, sizes, split direction, focus, borderless panes, start/close flags, stacks/expansion flags, and location-only plugin nodes. Floating/swap/new-tab layouts, external includes, `contents_file`, annotations, and arbitrary plugin configuration are outside this release. Tab templates require one explicit `children` placeholder. Put `size` on pane-template uses, not definitions: the pinned native parser rejects the ambiguous sized bar-template form tested in the first gate. Native validation for arbitrary user exports is not performed by the JavaScript assembler.

The parser is `@bgotink/kdl` **0.4.0**, using only its explicit KDL v1 parser. Its formatter is never used, so its v1-to-v2 formatting metadata does not change exported KDL syntax. Duplicate entries remain observable and are rejected.

Bounds: 1 MiB complete JSON input, 16 modules, 16 projects, 64 total definitions, 4,096 parsed nodes per fragment, depth 24, a conservative 8,192-node expansion estimate per exported project, 32 arguments per `args` node, and 4 MiB total assembled KDL. Source-map ranges include exclusive UTF-8 byte offsets and one-based lines, counting CRLF/CR/LF/NEL/U+2028/U+2029 without rewriting any original bytes.

## Native-first test

The probe depends directly on unmodified **zellij-utils = 0.45.1**, pinned to upstream commit [`efd8fd5a89a20c07a111d248ad7fce53848d2c18`](https://github.com/zellij-org/zellij/tree/efd8fd5a89a20c07a111d248ad7fce53848d2c18). `scripts/check-native-provenance.py` checks the Cargo package's clean VCS identity and every pinned file under `zellij-utils/src`, then retains the resolved lock and dependency license/checksum metadata.

The actual [`Layout::from_kdl`](https://github.com/zellij-org/zellij/blob/efd8fd5a89a20c07a111d248ad7fce53848d2c18/zellij-utils/src/kdl/mod.rs) parses four generated files. Its complete `Layout` objects must equal independently hand-written references, including default/new-tab template and swap fields. No handwritten replacement structs or normalization of the comparison is used. The references expand all custom names into ordinary panes/tabs and independently state the default frame, because the native `Layout.template` is part of full equality.

Alpha has one Dev tab with an editor and a test command. Beta has two tabs with distinct cwd/focus settings. A single shared edit from `args "test"` to `args "test" "-race"` must change exactly two native test-command argument vectors; a cloned before-layout with only those edits must equal the full after-layout. Native invalid duplicate/missing/cyclic/children fixtures must fail parsing. Argument-boundary and cwd mutations must fail the native equality oracle.

The expected positive result remains **unproven until the corrected native equality gate passes**. [The first run](https://github.com/Masanori-Spec/pane-weave/actions/runs/37452441547) verified all 212 upstream source files and compiled the real crate, then rejected `size` on a bar-template definition. Sizes were moved to its uses; the independently written references and full equality oracle are unchanged. The resolved 283-dependency Cargo lock from that compile is retained and enforced for the retry. [Workflow runs](https://github.com/Masanori-Spec/pane-weave/actions/workflows/native-gate.yml) are the source of truth. Parsing does not establish terminal rendering, command success, plugin behavior, or session usability.

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

It reads synthetic fixture files only. Cargo downloads are test dependencies; they are not bundled or uploaded with the original source deliverable. CI uploads only `evidence/`, excluding the compiler, registry source, target directory, embedded plugin assets, and binaries.

## Prior work and licensing

[Zellij #2696](https://github.com/zellij-org/zellij/issues/2696) and [#3835](https://github.com/zellij-org/zellij/issues/3835) discuss reusable panes/layout fragments. Native [pane/tab templates](https://zellij.dev/documentation/creating-a-layout.html) and [plugin aliases](https://zellij.dev/documentation/plugin-aliases) already solve important reuse problems. [Zellaygen](https://github.com/Axect/Zellaygen), [zellij-layout-generator](https://github.com/BernardIgiri/zellij-layout-generator), and [zellij-workspace](https://github.com/vdbulcke/zellij-workspace) are existing generators/workspace tools. The narrow workflow explored here is multiple explicit fragments, conflict checks, per-project assembly, and source maps. Demand, novelty, adoption, and commercial viability remain unvalidated. No new template engine or unique algorithm is claimed.

No license grant is made for original PaneWeave code. Dependency notices are scoped in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). No vendor implementation code, binaries, fonts, plugins, caches, credentials, or user configuration is included in the source archive.
