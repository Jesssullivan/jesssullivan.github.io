# typescript-eslint: no minimal patch for TypeScript 7 as `typescript`

For the operator (RU13). This one is a documented gap, not a patch.

- Repository: https://github.com/typescript-eslint/typescript-eslint
- Version in use: `typescript-eslint@8.71.1` (peer `typescript >=4.8.4 <6.1.0`)

## Problem

typescript-eslint uses the classic TypeScript JS API to parse, even for untyped lint, and loads it
with `require("typescript")` in about 100 compiled modules across `@typescript-eslint/*`
(typescript-estree, parser, eslint-plugin, project-service, type-utils, utils) and
`ts-api-utils`. TypeScript 7's `typescript` entry point exports only `version`, so linting fails
on `typescript@7.0.2`. A per-file patch of that size would not be minimal or reviewable.

## What this repo does instead

`scripts/typescript6-api-hook.mjs` is a Node `module.registerHooks` resolve hook (Node >= 22.15).
`npm run lint` loads it with `node --import`. It sends `typescript` and `typescript/*` to the
TypeScript team's `@typescript/typescript6` package, but only for importers inside
`typescript-eslint`, `@typescript-eslint/*` and `ts-api-utils`. Every other importer still gets
TypeScript 7. The ESLint config (`ts.configs.recommended`) is untyped, so lint semantics do not
change.

## Upstream ask (for the operator to raise)

Load the TypeScript API through one module that prefers `typescript` when it has the classic API
and otherwise uses `@typescript/typescript6`. Widen the peer to include `^7` with the companion as
an optional peer. svelte-check already has the same need (see svelte-check.md).
