---
title: "Week Notes: Indeterminism, Passkeys, and Spring"
date: "2026-03-21"
description: "Now that determinism governs my computing life, I've gotten fascinated by indeterminism in legacy systems. Also: cmux FIDO2 patches, qutebrowser lab builds, a MacBook Neo teletype, 20km on legs, and the BCI rack idles at 4kWh."
tags: ["weeknotes", "foss", "indeterminism", "nix", "cmux", "qutebrowser", "fido2", "ambienttalk", "climbing", "bci", "promise-theory", "music", "jazz", "metal"]
category: "personal"
published: false
slug: "week-notes-indeterminism-passkeys-and-spring"
excerpt: "Determinism begets fascination with indeterminism. cmux FIDO2 patches, qutebrowser passkey work, a MacBook Neo as a teletype, 20km spring run, lead climbing, and the BCI server rack draws a concerning 4kWh at idle."
feature_image: "/images/posts/IMG_2147.jpg"
---

![Spring grilling](/images/posts/IMG_2147.jpg)

The grill is out for first-of-the-spring burgers and I spotted my first groundhog of the year peeking out this morning. Spring is real.

## The Indeterminism Bug

Now that much of my personal computing life is largely governed by determinism -- Nix, functional programming, f-coalgebra, hermetic builds, content-addressed stores -- I've gotten genuinely excited about indeterminism in legacy systems and software engineering.

It started with Mark Burgess's convergence vs. congruence distinction from [Promise Theory (2004)](https://dl.acm.org/doi/fullHtml/10.5555/2666018.2666021). Burgess identified what I think is the central tension in infrastructure automation: congruent systems repeat an ordered recipe of steps (Ansible, shell scripts, most deployment pipelines), while convergent systems declare a desired state and let the system figure out how to get there (Nix, NixOS, the platonic ideal of what Ansible markets itself as). Most tools claim to be convergent while actually being congruent. The distinction matters enormously when you're trying to automate something that fights back.

I've been dredging up public remnants of [AmbientTalk](https://soft.vub.ac.be/amop/) this week and fell down the rabbit hole hard. Dove deep into the work of [Coen De Roover](https://soft.vub.ac.be/~cderoove/) and the [AMOP research group](https://soft.vub.ac.be/amop/) at VUB -- fascinating programming models for systems where failure is the norm, not the exception. Ambient networks, mobile devices, intermittent connectivity. Their language treats network partitions and partial failures as first-class citizens rather than edge cases to be papered over. The AmbientTalk codebase itself is largely gone now -- the Google Code archive is all that remains publicly, and the GitLab repository appears to be private or decommissioned -- but the papers hold up beautifully. This resonates with every deployment pipeline I've ever written.

The papers on [concolic testing for large systems](https://drops.dagstuhl.de/storage/00lipics/lipics-vol134-ecoop2019/LIPIcs.ECOOP.2019.27/LIPIcs.ECOOP.2019.27.pdf) are particularly compelling. Symbolic execution meeting concrete test traces to explore paths through systems that are too large and too stateful for exhaustive testing. The kind of thing you wish you had when your Ansible playbook works on the test VM and explodes in production because the order of `yum` transactions interacted with a kernel module you didn't know was loaded.

I've been chewing on this in the context of my DegreeWorks deployment work. The [OOPSLA 2016 Distinguished Paper](https://dl.acm.org/doi/10.1145/2983990.2984000) by Hanappi, Hummer, and Dustdar formalized exactly the problem I kept slamming into: configuration scripts must satisfy a preservation property across all pairs of resources for reliable convergence. When one of those "resources" is a proprietary ksh installer that modifies hundreds of files and expects interactive terminal access, preservation is violated before you even start. The [IEEE SANER 2019 survey](https://ieeexplore.ieee.org/document/8919181/) by Guerriero et al. confirmed what I suspected: teams routinely resort to imperative escape hatches (`shell`, `command`, `raw`) that destroy the declarative properties they sought. We all do this.

More on the broader IaC trajectory -- from Ansible to bash to Haskell orchestrator to Nix -- in a companion piece soon.

## FOSS: cmux and Passkeys

I use a wide variety of hardware security keys for work and at home -- YubiKeys, SoloKeys, some weirder things. This week was all about FIDO2 support improvements in two projects I care about.

**[cmux](https://cmux.com/)** -- I quite like this shell multiplexer. Contributed a [captcha handling fix](https://github.com/manaflow-ai/cmux/pull/1876) that merged, and I've been building out an [authenticator JS bridge](https://github.com/manaflow-ai/cmux/pull/1877) to handle a broader assortment of passkey hardware and richer WebAuthn implementations. The current FIDO2 path has some limitations around discoverable credentials and complex attestation flows that I'm working through. I've also started investigating direct [CTAP2](https://fidoalliance.org/specs/fido-v2.1-ps-20210615/fido-client-to-authenticator-protocol-v2.1-ps-20210615.html) integration as an alternative to expanding the application's required entitlements from Apple -- fewer entitlements, more portable, less platform coupling.

**qutebrowser** -- Improved FIDO2 supportability on my [Tinyland lab builds](https://github.com/Jesssullivan/qutebrowser), which are fairly deviated from upstream at this point. Opened a [FIDO2 PR upstream](https://github.com/qutebrowser/qutebrowser/pull/8642) and did some additional testing. The lab build has diverged enough that some of this work is Tinyland-specific, but the FIDO2 plumbing improvements should generalize.

## The MacBook Neo Teletype

I bought myself a MacBook Neo to serve as a dedicated teletype machine for the servers in the basement. It is a genuinely pleasant experience. Think AlphaSmart vibes but with cmux and SSH -- a focused, distraction-minimal interface to all my machines. No browser tabs, no notifications, just a terminal multiplexer and a good keyboard. I recommend this workflow to anyone running a homelab who has considered bolting a keyboard to a rack.

## Listening

Rec from my dear friend Lena: [*The Colours of Chloe*](https://tidal.com/album/13466598/u) ([Apple Music](https://music.apple.com/us/album/the-colours-of-chlo%C3%AB/1696074362)) -- weird German ECM-style jazz from 1974. Eberhard Weber. The kind of record that sounds like it was recorded in a cathedral made of felt. Absolutely gorgeous.

This [YoungArts Week performance](https://youtu.be/UgnuMd7HaNw) -- the comments section is as good as the music.

Been revisiting my Miss May I albums again, including the re-recordings. I find the redux releases genuinely amusing. The originals have what I can only describe as "dithered by accident because the grooves go just that hard" -- a kind of analog overdriven chaos in the production that is actually part of the experience. The re-recordings lose that and introduce their own wonky production artifacts that are, honestly, just as charming in a completely different way. [*Apologies Are for the Weak Redux*](https://tidal.com/album/398424912/u) is the one I keep coming back to.

## Spring Legs

Ran 20km this week and did some lead climbing. It's spring and I'm itching to get back on the bike once it warms up a bit more. The Petzl Neox continues to be the best belay device I've ever used.

## BCI Server Update

The XR Linux kernel RT Rocky BCI server is flying. Much Haswell-era bifurcation bending, GPU patching, NUMA tuning, and timing work is largely complete -- it is always nice to whip out the [Chapel](https://chapel-lang.org/) chops for multisocket activities. Working on a full writeup.

The BCI server rack idles around 4kWh, which is a tad concerning from a power bill perspective but not from a performance one. Two PSUs drawing 2300 watts at full bore will do that.
