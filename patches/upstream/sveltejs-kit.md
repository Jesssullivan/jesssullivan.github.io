# sveltejs/kit: load the TypeScript API from `@typescript/typescript6` when `typescript` is 7

For the operator to file upstream (RU13: we never open PRs or issues on repositories we do not own).

- Repository: https://github.com/sveltejs/kit
- Package and version patched locally: `@sveltejs/kit@3.0.1` (`patches/@sveltejs__kit@3.0.1.patch`)
- Files: `packages/kit/src/core/sync/ts.js`, `packages/kit/src/core/sync/write_tsconfig/index.js`,
  `packages/kit/src/core/sync/write_types/index.js`
- Source of the patch: the shared RU13 set in xoxd-ai/site.scaffold (U1, PR #225 at 7a31cce), copied verbatim.
  The upstream-ready diff against the kit monorepo is `sveltejs-kit-sync-typescript7.diff` in this directory.
  Beyond the companion fallback described below, it adds `ts_installed`, so `$types` still generate when
  TypeScript 7 is installed without the companion (the load-function proxies and tsconfig validation are skipped).

## Problem

TypeScript 7.0.2 (the native compiler) is published as `typescript`, but its entry point
(`lib/version.cjs`) exports only `version` and `versionMajorMinor`. Kit's
`write_tsconfig` imports `typescript` and calls `ts.readConfigFile(file, ts.sys.readFile)`.
The `if (!ts)` guard does not fire because the module exists, so every `vite build` and
`svelte-kit sync` crashes:

```
TypeError: Cannot read properties of undefined (reading 'readFile')
    at load_tsconfig (@sveltejs/kit/src/core/sync/write_tsconfig/index.js:194)
```

`write_types` (route `$types` generation) has the same exposure through `sync/ts.js`
(`ts.createSourceFile` in `tweak_types`).

## Change

The TypeScript team publishes the TypeScript 6 API as `@typescript/typescript6`
(maintainers include jakebailey, andrewbranch, weswigham) for tools that still need the classic
API next to TypeScript 7. `sync/ts.js` falls back to it when `typescript` has no
`createSourceFile`. `write_tsconfig` reuses that shared loader instead of its own import.
Without the companion package, Kit behaves as if TypeScript were absent: it skips type
generation and does not crash.

A follow-up upstream would add `"@typescript/typescript6": "^6.0.0"` as an optional peer and
widen the `typescript` peer to `^6.0.0 || ^7.0.0`.

## Diff (against sveltejs/kit at `@sveltejs/kit@3.0.1`)

```diff
diff --git a/packages/kit/src/core/sync/ts.js b/packages/kit/src/core/sync/ts.js
index 7f161e6..b33cc95 100644
--- a/packages/kit/src/core/sync/ts.js
+++ b/packages/kit/src/core/sync/ts.js
@@ -4,3 +4,15 @@ export let ts = undefined;
 try {
 	ts = (await import('typescript')).default;
 } catch {}
+
+// TypeScript 7 (the native compiler) ships no classic JavaScript API: the
+// `typescript` entry point exports only `version`. The TypeScript team
+// publishes the TypeScript 6 API as `@typescript/typescript6` for tools that
+// still need it, so fall back to that package when `typescript` lacks the API.
+// Without it, type generation is skipped exactly as if TypeScript were absent.
+if (ts && typeof ts.createSourceFile !== 'function') {
+	ts = undefined;
+	try {
+		ts = (await import('@typescript/typescript6')).default;
+	} catch {}
+}
diff --git a/packages/kit/src/core/sync/write_tsconfig/index.js b/packages/kit/src/core/sync/write_tsconfig/index.js
index a543762..7fc8beb 100644
--- a/packages/kit/src/core/sync/write_tsconfig/index.js
+++ b/packages/kit/src/core/sync/write_tsconfig/index.js
@@ -14,14 +14,9 @@ import * as e from '../../../messages/build-errors.js';
 import * as w from '../../../messages/build-warnings.js';
 import { posixify } from '../../../utils/os.js';
 import { bullet_list } from '../../../utils/format.js';
-
-/** @type {typeof import('typescript')} */
-let ts;
-try {
-	ts = await import('typescript');
-} catch {
-	// The user has not installed TypeScript.
-}
+// Shared loader: `undefined` when TypeScript (or, for TypeScript 7, its
+// `@typescript/typescript6` API companion) is not installed.
+import { ts } from '../ts.js';
 
 /**
  * Generates the tsconfig that the user's tsconfig inherits from.
```

## Verification

Done in Jesssullivan/jesssullivan.github.io with `typescript@7.0.2` and
`@typescript/typescript6@6.0.2`: `svelte-kit sync`, `vite build` (adapter-static and
adapter-node) and `svelte-check --tsgo`. The receipt has the run details.
