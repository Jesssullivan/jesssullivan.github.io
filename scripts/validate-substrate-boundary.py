#!/usr/bin/env python3
"""Substrate-boundary conformance (TIN-2423 / ledger item 30, consumer-side).

Asserts ADR-008 "logical replaceability" as a checked invariant instead of
prose: this repo's CODE surfaces may reach the blahaj substrate ONLY through
named interfaces recorded (with provenance) in
config/substrate-boundary-allowlist.json. Docs (*.md) are exempt — the
invariant is about code reach, not prose mentions.

Flagged reach classes (TIN-2423 item 1):
  repo-ref    a tinyland-inc/blahaj reference (module source, workflow
              dispatch target, checkout) in a code surface
  path-reach  a sibling/home-relative filesystem reach into a blahaj
              checkout (../blahaj, ~/git/blahaj, /git/blahaj)
  state-key   an OpenTofu backend key under the blahaj/ state prefix

Exit 0 = conformant (allowlisted hits are reported, not failed).
Exit 1 = un-allowlisted reach (the boundary bleed class of TIN-2398/2406).
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ALLOWLIST = REPO / "config" / "substrate-boundary-allowlist.json"

# Code surfaces (git-tracked). Markdown is exempt everywhere.
# Adapted for jesssullivan.github.io's layout: no tofu/, deploy/, or
# flake.nix here — this is a SvelteKit blog + Cloudflare Workers site with
# its own workers/, packages/, e2e/, and infra/ (Cloudflare zone config).
CODE_GLOBS = [
    ".github/workflows/**", "scripts/**", "workers/**", "src/**", "e2e/**",
    "infra/**", "packages/**",
    "Justfile", "MODULE.bazel", "**/*.bzl", "**/BUILD.bazel",
]

PATTERNS = {
    "repo-ref": re.compile(r"tinyland-inc/blahaj"),
    "path-reach": re.compile(r"(\.\./|~/git/|/git/)blahaj\b"),
    "state-key": re.compile(r"key\s*=\s*\"blahaj/"),
}


def tracked_code_files() -> list[Path]:
    out = subprocess.run(
        ["git", "ls-files", "--"] + CODE_GLOBS,
        cwd=REPO, capture_output=True, text=True, check=True,
    ).stdout.splitlines()
    return [Path(p) for p in sorted(set(out)) if not p.endswith(".md")]


def load_allowlist() -> list[dict]:
    data = json.loads(ALLOWLIST.read_text())
    entries = data["allowed"]
    for e in entries:
        for field in ("path_prefix", "interface", "provenance"):
            if field not in e:
                raise SystemExit(
                    f"allowlist entry missing {field!r} (provenance-carrying "
                    f"allowlists are the contract, TIN-2398 guardrail #2): {e}"
                )
        for field in ("decision", "date"):
            if field not in e["provenance"]:
                raise SystemExit(f"allowlist provenance missing {field!r}: {e}")
    return entries


def scan(files: list[Path], allowed: list[dict]):
    violations, allowed_hits = [], []
    for rel in files:
        path = REPO / rel
        try:
            text = path.read_text(errors="replace")
        except (OSError, IsADirectoryError):
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            for kind, rx in PATTERNS.items():
                if not rx.search(line):
                    continue
                entry = next(
                    (e for e in allowed if str(rel).startswith(e["path_prefix"])),
                    None,
                )
                record = (str(rel), lineno, kind, line.strip()[:120])
                (allowed_hits if entry else violations).append(record)
    return violations, allowed_hits


def self_test() -> None:
    cases = {
        "repo-ref": 'uses: tinyland-inc/blahaj/.github/workflows/x.yml@main',
        "repo-ref-dispatch": 'gh api repos/tinyland-inc/blahaj/dispatches -f event_type=x',
        "path-reach": 'source = "../blahaj/tofu/modules/thing"',
        "path-reach-home": 'cd ~/git/blahaj && just apply',
        "state-key": 'key = "blahaj/mail/terraform.tfstate"',
    }
    for name, sample in cases.items():
        if not any(rx.search(sample) for rx in PATTERNS.values()):
            raise SystemExit(f"self-test FAILED: {name!r} not detected")
    clean = 'key = "tinyland-infra/attic/terraform.tfstate"  # fine'
    if any(rx.search(clean) for rx in PATTERNS.values()):
        raise SystemExit("self-test FAILED: false positive on clean line")
    # allowlist suppression
    allowed = [{"path_prefix": "tofu/modules/spoke-blahaj-app-install/",
                "interface": "t", "provenance": {"decision": "t", "date": "t"}}]
    v, a = [], []
    entry = next((e for e in allowed
                  if "tofu/modules/spoke-blahaj-app-install/main.tf".startswith(e["path_prefix"])), None)
    (a if entry else v).append("x")
    if v or not a:
        raise SystemExit("self-test FAILED: allowlist suppression broken")
    print("substrate-boundary self-test passed")


def main() -> int:
    if "--self-test" in sys.argv:
        self_test()
        return 0
    allowed = load_allowlist()
    violations, allowed_hits = scan(tracked_code_files(), allowed)
    for rel, lineno, kind, frag in allowed_hits:
        print(f"allowed [{kind}] {rel}:{lineno}: {frag}")
    if violations:
        print(f"\nsubstrate-boundary FAILED: {len(violations)} un-allowlisted "
              f"blahaj reach(es) — consume the substrate via a named interface "
              f"or add a provenance-carrying allowlist entry (TIN-2423):",
              file=sys.stderr)
        for rel, lineno, kind, frag in violations:
            print(f"  [{kind}] {rel}:{lineno}: {frag}", file=sys.stderr)
        return 1
    print(f"substrate-boundary validation passed "
          f"({len(allowed_hits)} allowlisted hit(s), 0 violations)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
