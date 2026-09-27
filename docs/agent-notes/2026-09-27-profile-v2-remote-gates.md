# Profile v2: remote gate failure and provider handoff

Read-only investigation on 2026-09-27. Candidate remains
`b1a0d6776b829818cf33f5723004458a5c2af86d` on `jess/profile-v2-map`.
No application, graph, data, workflow, substrate-policy, or private-CV changes
were needed or made. This note and its index row are the only tracked edits.

## Finding

Both the broker repair PR285 and profile PR286 failed in `Remote check`
while downloading cached blobs, with the same service error:

```text
RESOURCE_EXHAUSTED: rpc error: code = ResourceExhausted desc =
blob transfer pending queue exhausted: pending=64/64
```

| Candidate | Canonical failed job | Head and attempt | Observed failure window (UTC) |
| --- | --- | --- | --- |
| Broker quarantine PR285 | [Run 36283535914, job 108521946169](https://github.com/Jesssullivan/jesssullivan.github.io/actions/runs/36283535914/job/108521946169) | `4a9e09ccf30654bf509cfff1d9a0b04bb030a89a`, attempt 2 | First cache error 01:09:18; exit 39 at 01:12:11 |
| Profile PR286 | [Run 36293244579, job 108547204193](https://github.com/Jesssullivan/jesssullivan.github.io/actions/runs/36293244579/job/108547204193) | `b1a0d6776b829818cf33f5723004458a5c2af86d`, attempt 1 | First cache error 04:10:46; exit 39 at 04:13:16 |

Both jobs used the `tinyland-dind` capability label, on separate
`jesssullivan-blog-dind-nwtnn-runner-*` runners. Browser provisioning, token
minting, token refresh, and strict cache attachment all passed. Three targets
were analyzed; the eventual failures name `workspace_package_checks`,
`sveltekit_check`, and/or `sveltekit_vite_build_smoke` but explicitly say
`Failed to fetch blobs because of a remote cache error`. Neither run reached
`Remote test` or `Remote e2e`; those steps are skipped. There is no application
assertion failure or authentication refusal in these logs. This does not
establish that the skipped gates would pass.

Each invocation reports five transient-cache rebuild retries before exit 39.
The repository wrapper retries only the distinct exit-34 tenant execution
limit condition (`scripts/bazel-cache-backed.sh:283`); it correctly propagates
this failure. Changing its error matcher or increasing retries would not
constitute a demonstrated repair.

PR285's four-file diff was inspected: it quarantines unsupported broker
content and makes the raw-tag validator stateless. It does not change the
cache transport. That TIN-4971 repair remains independently owned and was
not copied into this branch.

## Owner contract and evidence limits

The blog's `AGENTS.md` assigns runner/cache/RBE substrate to GloriousFlywheel
and application delivery to this repo. Its currently executed CI contract is
`shared-cache-backed`, tenant-scoped PR cache-read, no executor, one local
action/test at a time. These settings remain unchanged. Serial local actions
do not prove bounded concurrency of their many blob downloads.

Current provider source was inspected at
[`xoxd-ai/GloriousFlywheel` revision `74a24dae8a272d2758c111924595593738161152`](https://github.com/xoxd-ai/GloriousFlywheel/tree/74a24dae8a272d2758c111924595593738161152):

- [`blob_transfer.go:165`](https://github.com/xoxd-ai/GloriousFlywheel/blob/74a24dae8a272d2758c111924595593738161152/services/gf-reapi-cell/internal/cell/blob_transfer.go#L165)
  emits the exact observed error when the shared transfer waiters reach
  `maxPending`. The limiter bounds transfers independently of tenant
  execution quotas. It also enforces staging bytes and FIFO admission.
- [`gf-reapi-cell.yaml:240`](https://github.com/xoxd-ai/GloriousFlywheel/blob/74a24dae8a272d2758c111924595593738161152/deploy/gf-rbe/gf-reapi-cell.yaml#L240)
  declares local blob storage, 12 GiB staging, two concurrent transfers,
  64 pending transfers, and a two-minute idle timeout. These are checked-in
  provider settings, **not a verification of the deployed image/config**.
- [`blob_transfer_test.go:336`](https://github.com/xoxd-ai/GloriousFlywheel/blob/74a24dae8a272d2758c111924595593738161152/services/gf-reapi-cell/internal/cell/blob_transfer_test.go#L336)
  identifies the bounded admission metrics, including
  `gf_reapi_blob_transfer_pending` and
  `gf_reapi_blob_transfer_refused_total{reason="pending_full"}`.
- The provider's current [`AGENTS.md`](https://github.com/xoxd-ai/GloriousFlywheel/blob/74a24dae8a272d2758c111924595593738161152/AGENTS.md)
  and [runtime contract](https://github.com/xoxd-ai/GloriousFlywheel/blob/74a24dae8a272d2758c111924595593738161152/docs/build-system/gf-reapi-cell.md)
  require v4 owner operands, ActionPlan and provider-selected supply. Consumer
  code does not choose provider storage/capacity. The blog still executes its
  older shared-cache workflow. That adoption gap is separate from the
  observed transfer-queue failure; no ad hoc migration or hosted-runner
  fallback was attempted.

The logs establish queue exhaustion during CAS reads. They do not establish
whether slow backend I/O, another client's demand, a stalled stream, or client
fan-out caused the queue to fill. No live cluster metrics or provider logs
were retrieved, and no served provider revision is asserted.

## Concrete handoff

The GF provider/runtime owner should correlate these job windows with the
served image/config and transfer metrics, then inspect active read latency,
staging bytes, queue drain/cancellation, and concurrent consumer demand.
Initial Bazel invocation IDs are
`9ff043b3-24a6-4b8c-a430-52ee05410b3f` (PR285) and
`0dbb145f-33d5-4b11-b5c8-67ce7ff712cd` (PR286); the receipt below includes all
retry invocation IDs. Inspect admission/backpressure and backend throughput
before selecting a fix. Do not simply raise an unbounded capacity limit.

The adopter owner, `Jesssullivan/jesssullivan-infra`, and the GF owner should
separately reconcile this legacy blog lane with the current v4 adoption
contract. That work must preserve exact-source proof and the private-CV
boundary; it is not permission to bypass the current required check.

After a bounded provider repair is proven, the orchestrator can rerun the
failed jobs at their exact PR heads. Completion requires all three remote
stages: check, test, and e2e. No rerun, infrastructure mutation, external
handoff message, commit, push, merge, or publication was performed here.

## Receipts and verification

Ignored local evidence lives under `test-results/profile-v2/remote-gates/`:
`pr285.log`, `pr286.log`, the inspected provider files, and `receipt.json`.
The JSON records exact heads, attempts, log hashes, first/last error line
numbers, invocation IDs, and skipped-stage observations. Log hashes:

| File | SHA-256 |
| --- | --- |
| `pr285.log` | `94c77b40f1c51c5407ba1bc83049318cc3d5ef58de2f24bd6c8e85188ec57a4e` |
| `pr286.log` | `d7d0afb65a33fa28706cad4895c1f1fc67711f96a5fd58203c1730d93b40ece6` |

The receipt parser checked both complete logs; GitHub job metadata confirmed
the failing/skipped steps independently. `git diff --check` passes. No
application test rerun was warranted for this documentation-only finding.
The visual candidate and its prior static proofs remain unchanged. Jess's
LOOK, live profile-service readiness, private-CV pin consistency, the
independent broker repair, and canonical CI remain release gates.
