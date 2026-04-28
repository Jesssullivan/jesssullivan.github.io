---
title: "Smol DarwinNicUtil Has Docs and installers now, yay"
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

| Surface | URL |
| --- | --- |
| Docs (MkDocs) | <https://transscendsurvival.org/DarwinNicUtil/> |
| Source | <https://github.com/Jesssullivan/DarwinNicUtil> |
| PyPI | <https://pypi.org/project/darwin-mgmt-nic-configurator/> |
| FlakeHub | <https://flakehub.com/f/Jesssullivan/DarwinNicUtil> |
| GitHub Releases | <https://github.com/Jesssullivan/DarwinNicUtil/releases> |

This is my little mac-as-bastion tool for enterprise-like macs (ie, the bastion iteslf is compromised, root-limited and is used for OOB network configuration).

### Why you don't need this

In my case, I have a bastion mac mini that I federate with a my own MDM and declerative network stack.  Remember, as a crazy person, [WPA3 Enterprise 192-bit](https://smallstep.com/blog/home-network-eap-tls-wifi/) is far to simple minded for my basement; if you arn't managing a few dozen discreet eap-tls networks with Nix, ansible, does it even count as a lab?  anyway, my network topology is a story for another day, as it *changes pretty much every day* (as it has for most of my adult life).   This is where having a footgun safety t comes into play- enter **DarwinNicUtil**.

While to mini's network stack itself is out of the scope of this post, it mimics- to some degree- a managed enterprise workplace network stack with ABR, Nebula, Tailscale, ZTNA, multiple local profile-managed VPM connections for various local networks, ome of which are phyically air gapped by default as well (so switching physical NIC connections is required as part of use, which is a core source of failiure for macs as a bastion host- MacOS will try to re-organize and prioritize network devices, usually guessing incorrectly), thus the need for a bigger hammer. 


![DarwinNicUtil Mac bastion OOB flow](/images/posts/darwin-nic-bastion-flow.svg)

```txt
operator laptop |--> lab operator host -> tailnet, nebula or VPN -> Mac bastion -> USB management NICs -> managed switch/router
```

The split is like so:

- The cluster infra repo records the cluster-facing boundary and points at the correct owner repos.
- The network hardware repo owns switch topology, RouterOS hardening, MAC-Telnet helpers, and device-specific runbooks.
- The host configuration repo installs DarwinNicUtil on the Mac bastion and writes the management profile declaratively.
- DarwinNicUtil owns the host-side Mac behavior: selecting the USB NIC, assigning the management address, preserving Wi-Fi and tailnet access, and showing enough routing/NECP state to debug what macOS is doing.


## How usage looks

- **Tier A**: use `DarwinNicUtil` to configure the Mac USB management interface, then use normal TCP management to the OOB address when ordinary sockets are healthy.
- **Tier B**: use the network repo helper through the Mac bastion for read-only MAC-Telnet RouterOS inspection when the OOB link is alive but ordinary IP access is blocked.

The network hardware side deliberately keeps RouterOS-specific sharp edges out of `DarwinNicUtil`. The MAC helper is read-only by default, serial-use, command-allowlisted, and avoids putting RouterOS passwords in argv or temp files. Mutating flows stay in the network repo behind explicit `--execute` gates and typed success sentinels.

`DarwinNicUtil` does not lace with the MikroTik management tools either; It is the Mac bastion utility that makes the network runbook strict, rotatable, and boring.


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

Standalone binaries are not release artifacts yet. Homebrew is also deferred until there is a real tap and signing/release, which I will get around to at some point. 

For now, PyPI and Nix are the public paths.

## What is in the docs

The MkDocs site is structured around the way the tool is used in the lab:

- **Quickstart**: the basic install, status, init-config, and configure path.
- **CLI reference**: subcommands, flags, and behavior.
- **Bastion notes**: macOS-specific routing, Wi-Fi preservation, Tailscale, and NECP diagnostics.
- **Architecture**: platform detection, interface configuration, and profile resolution.
- **Project spec**: the ownership boundary between DarwinNicUtil, host configuration, network runbooks, and cluster documentation.

Cheers,
-Jess
