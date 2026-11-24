# xoxd projection

The consumer side of the `xoxd-projection/v2` contract. The hub renders every
post and signs a manifest for each target site. A site build runs this module
before it prerenders. The module fetches the manifest by its hash, verifies
it and every blob, and writes a directory the build reads. Bazel module
`xoxd_projection` supplies `//:pkg`, linked as `@xoxd/projection`, and
`//:fetch`, the fetcher command.

The module has no runtime dependency. It uses the Web Crypto API and standard
JavaScript. The sources in `src/` are TypeScript. The package ships them as
JavaScript in `dist/`, so it loads from `node_modules` on Node 22 and newer.
The types come from `src/`.

## Checks

The verifier enforces every consumer rule of the contract:

- The manifest's sha256 equals the hash it was fetched by.
- The detached ed25519 signature verifies over the exact bytes with the pinned key.
- The manifest is canonical JSON, fits the contract schema and names this
  site's target, origin and actor.
- Its `seq` is not lower than the last accepted `seq`. An equal `seq` must
  name the manifest built last, because the contract says it rebuilds the
  same manifest. `previous` is for audit only, as the contract states, so it
  is not compared.
- Ids are unique, every set is sorted, and paths and redirects follow the
  address rule.
- Each attachment's media type is on the allowlist and matches its path
  extension, its kind and its bytes.
- Each entry's approval hash is recomputed with canonical-v0 from the public
  Document blob, and the entry's metadata equals the Document's.
- Each blob matches its sha256 and size.
- Rendered HTML holds no script element, no event handler attribute and no
  `javascript:` URL, also inside `srcdoc`.

Each failure is a typed finding. Its code is the code the contract names.
The fetcher adds `head_invalid`, `dispatch_mismatch`, `base_url_invalid`,
`fetch_failed` and `output_failed`.

## Fail closed

A build fails on any finding. The fetcher exits non-zero and leaves the
previous output directory as it was. It writes into a new directory beside
the output and renames it into place only after everything verified. There is
no cached copy, no fallback and no retry through `head.json`. It reads
`head.json` only to check that the hub serves a head for this target. It
never takes the manifest from it.

## Command

```sh
bazel run @xoxd_projection//:fetch -- \
  --base-url https://<hub origin> --target blog \
  --manifest <sha256> --seq <n> \
  --public-key-file projection/hub-ed25519.pub --out src/lib/projection-data
```

Relative paths resolve against the directory the command runs in. The base
URL must be https. The fetcher joins the contract addresses, such as
`/projection/v2/blog/head.json`, to it. It does not follow a redirect, so
every request stays on https. The last build is the `seq` and `manifest` of a
receipt. `--last-receipt` names that receipt, such as a copy of the
`projection.json` the live site serves, and the file must exist. Without it
the fetcher reads the receipt already in the output directory. A missing one
there means a first build, with a last `seq` of 0. The command exits 0 on
success, 1 on any finding and 2 on a usage error.

The Bazel target and the package bin `xoxd-projection-fetch` both run
`dist/cli.js` on Node 22 and newer.

## Dispatch inputs

The hub starts a site build with three values: the manifest sha256, its `seq`
and the hub base URL. They map to `--manifest`, `--seq` and `--base-url`. The
contract README leaves their workflow input names to the emitter, so the names
come from the contract once it states them. This module does not name them.

## Pinned key

A site pins the hub's ed25519 public key in its own repository. The key is the
32 raw key bytes as standard base64 with padding: 44 characters in one file,
such as `projection/hub-ed25519.pub`. A key change is a reviewed commit in the
site. The fixture key under `testdata/` signs the tests only and must never be
pinned.

## Output directory

| Path | Content |
|---|---|
| `projection.json` | the receipt: `contract`, `target`, `seq` and `manifest`. A site serves it at `/.well-known/projection.json` |
| `manifest.json` | the exact signed manifest bytes |
| `posts/<id>.json` | one post: its metadata, `placement`, `approval`, its attachments and the rendered `html` |
| `attachments/<sha256>` | each attachment blob, named by its hash. A post lists each one's site `path`, `mediaType` and `file` |
| `redirects.json` | the permanent redirects, sorted by `from`: tombstone former paths with a live replacement and on-origin `legacyUrl` paths |
| `tombstones.json` | the retired posts. `redirectTo` is the replacement path, or null when each former path answers 410 Gone |

The same manifest always gives the same bytes.

## Library

```ts
import { verifyProjection } from '@xoxd/projection';
import { fetchProjection, readLastBuild } from '@xoxd/projection/fetch';

const result = await fetchProjection({
	baseUrl, target: 'blog', manifestSha256, seq, publicKey, outDir,
	...(await readLastBuild(lastReceiptFile, 'blog', false)),
	fetch: (url) => globalThis.fetch(url, { redirect: 'error' }),
});
if (!result.ok) throw new Error(result.findings.map((f) => f.code).join(', '));
```

`verifyProjection` takes the bytes of `head.json`, the manifest and its
signature, the pinned key, the dispatched sha256, the target, the last `seq`,
the last manifest sha256 and a blob reader. A site that has built nothing
passes `FIRST_BUILD`: a last `seq` of 0 and no last manifest. It returns the verified manifest with its blobs, or the
findings. `verifyManifestBytes`, `checkManifest`, `recomputeApproval`,
`checkRebuild`, `verifyBlob`, `sniffMediaType` and `checkHtml` run single
rules. The root
export needs no Node API. The `./fetch` export uses `node:fs`.

## Tests

`//:test` runs the conformance suite with `node:test`. `testdata/` holds the
contract fixtures, schemas and canonical-v0 vectors, copied byte for byte from
`xoxd-projection/v2` at commit `d91134c54`. `testdata/SHA256SUMS` lists their
hashes, and a test fails when one drifts. In site.scaffold, `just check` runs
the suite and a type check.

`dist/` is generated. After a change in `src/`, `just projection-emit` in
site.scaffold rewrites it with `tools/emit-js.ts`. The suite fails while
`dist/` differs from what `src/` emits.
