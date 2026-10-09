# sveltejs/language-tools: run svelte-check with TypeScript 7 as `typescript`

For the operator to file upstream (RU13: we never open PRs or issues on repositories we do not own).

- Repository: https://github.com/sveltejs/language-tools (master af7c6a5 at time of writing)
- Package and version patched locally: `svelte-check@4.7.6` (`patches/svelte-check@4.7.6.patch`)
- Source files the change belongs in: `packages/svelte-check/bin/ts-version-check.js`,
  `packages/svelte-check/src/tsgo.ts` (`tryParseTsGoVersion`), and the shared `typescript`
  import that rollup bundles into `dist/src/index.js` (svelte2tsx and svelte-language-server)

## Problem

svelte-check 4.7.6 supports TypeScript 7 only when TypeScript 6 is the `typescript` package
and TypeScript 7 sits under an npm alias (`@typescript/native` or
`@typescript/native-preview`). With `typescript@7.0.2` installed directly:

1. `bin/ts-version-check.js` refuses to start: "TypeScript 7 support currently requires both
   TypeScript 7 and TypeScript 6 installed".
2. The bundle's `require('typescript')` (used by svelte2tsx to parse `<script>` blocks) gets a
   module with no API.
3. `--tsgo` looks only for the two alias names, so it cannot find TypeScript 7 as `typescript`.

## Change

- The version check accepts `typescript` >= 7 when `@typescript/typescript6` (the TypeScript
  team's TypeScript 6 API package) can be resolved.
- The API import falls back to `@typescript/typescript6` when `typescript` has no
  `createSourceFile`. Upstream this belongs in one shared `typescript` loader that svelte2tsx,
  the language server and svelte-check all import. The local patch edits the bundle line,
  because the published package has no unbundled source.
- `tryParseTsGoVersion` also accepts `typescript` itself at major >= 7, which makes `--tsgo`
  use `node_modules/typescript/bin/tsc` (7.0.2).

Type checking always runs on TypeScript 7 through `svelte-check --tsgo`. The TypeScript 6 API
only parses Svelte script blocks for svelte2tsx.

## Diff for `bin/ts-version-check.js` (applies to the repo as is)

```diff
diff --git a/packages/svelte-check/bin/ts-version-check.js b/packages/svelte-check/bin/ts-version-check.js
index bf0dd7c..623bc0b 100644
--- a/packages/svelte-check/bin/ts-version-check.js
+++ b/packages/svelte-check/bin/ts-version-check.js
@@ -23,6 +23,12 @@ function checkTypeScriptVersion(version) {
                 requirement + `You are using unsupported TypeScript ${version}. \n\nNote that `;
         } else if (major < 7) {
             return;
+        } else if (hasTypeScript6Api()) {
+            // TypeScript 7 is the installed `typescript` and the TypeScript
+            // team's `@typescript/typescript6` package provides the classic
+            // API that svelte2tsx needs. Type checking itself has to run on
+            // TypeScript 7 through --tsgo.
+            return;
         }
     } else {
         message +=
@@ -37,3 +43,12 @@ function checkTypeScriptVersion(version) {
 
     throw new Error(message);
 }
+
+function hasTypeScript6Api() {
+    try {
+        require.resolve('@typescript/typescript6');
+        return true;
+    } catch {
+        return false;
+    }
+}
```

## Diff for `src/tsgo.ts`

```diff
--- a/packages/svelte-check/src/tsgo.ts
+++ b/packages/svelte-check/src/tsgo.ts
@@ -16,4 +16,6 @@ export function tryParseTsGoVersion(tsconfigPath: string): PkgInfo | null {
     const pkg =
         tryParsePkg(tsconfigPath, '@typescript/native') ??
-        tryParsePkg(tsconfigPath, '@typescript/native-preview');
+        tryParsePkg(tsconfigPath, '@typescript/native-preview') ??
+        // TypeScript 7 installed directly as `typescript` (no npm alias).
+        tryParsePkg(tsconfigPath, 'typescript');
```

The bundle hunk in `patches/svelte-check@4.7.6.patch` shows the loader's intended behaviour.

## Gap

The default (non-`--tsgo`) svelte-check mode type-checks through the TypeScript 6 language
service. On a TypeScript 7 project it would check with TypeScript 6 semantics, so this estate
runs only `svelte-check --tsgo`.

## Also carried: stale emit directory under `--tsgo` (adopted from site.scaffold#225, U1)

`svelte-check --tsgo` without `--incremental` starts from an empty manifest but never cleared
its emit directory, and every file there is part of the overlay program, so the svelte2tsx
output of a deleted `.svelte` file kept being type-checked. The third hunk of
`patches/svelte-check@4.7.6.patch` starts from an empty directory when there are no manifest
entries to prune from. Upstream-ready diff against `packages/svelte-check/src/incremental.ts`:
`patches/upstream/sveltejs-language-tools-svelte-check-tsgo-stale-emit.diff` (verbatim from U1).
