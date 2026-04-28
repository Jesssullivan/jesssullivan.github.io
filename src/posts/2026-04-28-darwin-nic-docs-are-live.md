---
title: "DarwinNicUtil Has a Docs Route Now"
date: "2026-04-28"
description: "DarwinNicUtil v2.1.2 is documented, packaged on PyPI and FlakeHub, and now reflects the Mac-bastion OOB flow I use to manage lab network hardware."
tags: ["macOS", "Networking", "Nix", "Python", "Docs", "Tailscale"]
published: false
slug: "darwin-nic-docs-are-live"
category: "devops"
source_repo: "Jesssullivan/DarwinNicUtil"
feature_image: "/images/posts/darwin-nic-bastion-flow.png"
---

The public [DarwinNicUtil](https://github.com/Jesssullivan/DarwinNicUtil) docs are live, and the current release, `v2.1.2`, is available through PyPI, GitHub Releases, and FlakeHub.

This is the small Mac-side tool I use for out-of-band network maintenance in a hardened lab. The generic operator path looks like this:

![DarwinNicUtil Mac bastion OOB flow](/images/posts/darwin-nic-bastion-flow.svg)

```txt
operator laptop -> tailnet or VPN -> Mac bastion -> USB management NIC -> managed switch/router
```

The split is intentional:

- The cluster infra repo records the cluster-facing boundary and points at the correct owner repos.
- The network hardware repo owns switch topology, RouterOS hardening, MAC-Telnet helpers, and device-specific runbooks.
- The host configuration repo installs DarwinNicUtil on the Mac bastion and writes the management profile declaratively.
- DarwinNicUtil owns the host-side Mac behavior: selecting the USB NIC, assigning the management address, preserving Wi-Fi and tailnet access, and showing enough routing/NECP state to debug what macOS is doing.

That boundary mattered during rack-out maintenance last weekend. Normal TCP from the Mac bastion to the managed switch OOB address returned `No route to host`, but link-layer access was still alive. The switch was not dead; the host path was. `darwin-nic status` and the network repo's MAC helper let us separate macOS/Tailscale/NECP behavior from RouterOS state, then continue over the MAC-only path without turning live switch recovery into guesswork.

The longer design note is here: [Mac Bastion USB OOB for Network Gear](/blog/darwin-nic-mac-bastion-usb-oob).

## What I am using it for

The current lab flow has three levels:

- **Tier A**: use DarwinNicUtil to configure the Mac USB management interface, then use normal TCP management to the OOB address when ordinary sockets are healthy.
- **Tier B**: use the network repo helper through the Mac bastion for read-only MAC-Telnet RouterOS inspection when the OOB link is alive but ordinary IP access is blocked.
- **Tier C**: use physical console/reset only after the software and link-layer paths are exhausted.

The network hardware side deliberately keeps RouterOS-specific sharp edges out of DarwinNicUtil. The MAC helper is read-only by default, serial-use, command-allowlisted, and avoids putting RouterOS passwords in argv or temp files. Mutating flows stay in the network repo behind explicit `--execute` gates and exact success sentinels.

DarwinNicUtil is not a MikroTik management tool. It is the Mac bastion utility that makes the network runbook strict, rotatable, and boring.

## Download and docs

| Surface | URL |
| --- | --- |
| Docs (MkDocs) | <https://transscendsurvival.org/DarwinNicUtil/> |
| Source | <https://github.com/Jesssullivan/DarwinNicUtil> |
| PyPI | <https://pypi.org/project/darwin-mgmt-nic-configurator/> |
| FlakeHub | <https://flakehub.com/f/Jesssullivan/DarwinNicUtil> |
| GitHub Releases | <https://github.com/Jesssullivan/DarwinNicUtil/releases> |

PyPI publishes through OIDC trusted publishing, so the release path does not depend on a long-lived PyPI token stored in GitHub. The package is still marked beta, macOS is the primary target, and the Linux path is experimental.

## Install paths

The generic install path is PyPI via `uv`:

```bash
uv tool install darwin-mgmt-nic-configurator
darwin-nic status
darwin-nic init-config
darwin-nic configure --profile homelab --preserve-wifi
```

Or, for a one-shot Nix run with no install:

```bash
nix run "https://flakehub.com/f/Jesssullivan/DarwinNicUtil/v2.1.2" -- status
```

Or, if you prefer the current repo flake over a tagged release:

```bash
nix profile install github:Jesssullivan/DarwinNicUtil
```

In my lab, the Mac bastion gets the tool through Home Manager from the DarwinNicUtil flake input and writes the management profile declaratively. Operators and agents use the repo-managed package and repo-managed profile, not a hand-maintained shell snippet on the bastion.

Source checkouts use `uv sync --extra dev` and the usual `just` recipes (`just check`, `just test`, `just docs-build`).

Standalone binaries are not release artifacts yet. Homebrew is also deferred until there is a real tap and signing/release story. For now, PyPI and Nix are the supported public paths.

## What is in the docs

The MkDocs site is structured around the way the tool is used in the lab:

- **Quickstart**: the basic install, status, init-config, and configure path.
- **CLI reference**: subcommands, flags, and behavior.
- **Bastion notes**: macOS-specific routing, Wi-Fi preservation, Tailscale, and NECP diagnostics.
- **Architecture**: platform detection, interface configuration, and profile resolution.
- **Project spec**: the ownership boundary between DarwinNicUtil, host configuration, network runbooks, and cluster documentation.
- **`llms.txt`**: compact model-facing context for agent-assisted maintenance.

The important baseline is in place: the docs route is live, the release artifacts are real, and the install commands resolve to maintained surfaces.

Small tool. Real operator surface.

-Jess
