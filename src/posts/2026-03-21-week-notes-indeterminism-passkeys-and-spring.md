---
title: "Week Notes: Indeterminism, Passkeys, and Spring"
date: "2026-03-21"
description: "Now that determinism governs my personal computing life, I've gotten fascinated by *indeterminism*, lol. Also: cmux FIDO2 patches, qutebrowser lab builds, Neo teletype, 20km on legs, and doh!  The BCI rack idles at 4kWh, probably should do somthing about that"
tags: ["weeknotes", "foss", "indeterminism", "nix", "cmux", "qutebrowser", "fido2", "ambienttalk", "climbing", "bci", "promise-theory", "music", "jazz", "metal"]
category: "personal"
published: true
slug: "week-notes-indeterminism-passkeys-and-spring"
excerpt: "Determinism begets fascination with indeterminism. FIDO2 work for cmux, qutebrowser & keepassxc, a 2026 teletype, 20km spring run, lead climbing, and the BCI server rack draws a concerning 4kWh at idle."
feature_image: "/images/posts/IMG_2147.jpg"
---

![Spring grilling and stuff](/images/posts/IMG_2147.jpg)

The grill is out for first-of-the-spring burgers and I spotted my first groundhog of the year peeking out this morning. Spring is real- also happy belated (ie, right on time) st. Patricks day dear reader, from a real life Sullivan ^w^  *corned beef curtesy of my lovely partner*

### Indeterminism Bugs me.  Therefore....

Now that much of my personal computing life is largely governed by determinism -- Nix, Haskell, Dhall, starting most sentences refering to f-coalgebra concepts, hermetic builds everywhere -- I've gotten genuinely excited about ***indeterminism*** in large legacy systems, as this > giving up and crying.

The convergence vs. congruence distinction from [Promise Theory (2004)](https://dl.acm.org/doi/fullHtml/10.5555/2666018.2666021) describes this tension I've been acutely aware of this winter in my automation work in higher ed: congruent systems repeat an ordered recipe of steps (Ansible, shell scripts, most deployment pipelines), while convergent systems declare a desired state and let the system figure out how to get there (Nix, NixOS, the platonic ideal of what Ansible originally marketed itself as, unfortunately). Most tools claim to be convergent while actually being congruent. The distinction matters enormously when you're trying to automate something that fights back, or a large army of things that fight back AND light your money on fire.

- [AmbientTalk paper](https://drops.dagstuhl.de/storage/00lipics/lipics-vol134-ecoop2019/LIPIcs.ECOOP.2019.27/LIPIcs.ECOOP.2019.27.pdf) 
- [OOPSLA 2016 Distinguished Paper](https://dl.acm.org/doi/10.1145/2983990.2984000)
- [IEEE SANER 2019 survey](https://ieeexplore.ieee.org/document/8919181/)
- I've been dredging up public remnants of [AmbientTalk](https://soft.vub.ac.be/amop/) and have had a fun time swimming around the work of [Coen De Roover](https://soft.vub.ac.be/~cderoove/), his students and the [AMOP research group](https://soft.vub.ac.be/amop/) at VUB. 

- - - 


## Listening

Rec from my dear friend Lena: [*The Colours of Chloe*](https://tidal.com/album/13466598/u) ([Apple Music](https://music.apple.com/us/album/the-colours-of-chlo%C3%AB/1696074362)) -- weird German ECM-style jazz from 1974. Eberhard Weber. The kind of record that sounds like it was recorded in a cathedral made of felt. Absolutely gorgeous.

This [YoungArts Week performance](https://youtu.be/UgnuMd7HaNw) -- the comments section is at least as good as the music.

Been revisiting my Miss May I albums again, including the re-recordings. I find the redux releases amusing. The originals have what I can only describe as "dithered by accident because the grooves go just that hard" -- a kind of analog overdriven chaos in the production that is actually part of the experience. The re-recordings lose that and introduce their own wonky production artifacts that are, honestly, just as charming in a completely different way. 

## Spring Legs

Ran 20km this week and did some lead climbing. It's spring and I'm itching to get back on the bike once it warms up a bit more. 

#### Random FIDO2 stuff from this week feat. teletype 2026 edition


**[cmux](https://cmux.com/)** -- I quite like this shell multiplexer and contributed a [captcha handling fix](https://github.com/manaflow-ai/cmux/pull/1877) that merged, and I've been building out better FIDO2 supportability in current and future cmux iterations. [The current FIDO2 development path has some limitations around attestation flows that musing about](https://github.com/manaflow-ai/cmux/pull/1877).  I've also started investigating direct [CTAP2](https://fidoalliance.org/specs/fido-v2.1-ps-20210615/fido-client-to-authenticator-protocol-v2.1-ps-20210615.html) integration as an alternative to expanding the application's required entitlements from Apple -- fewer entitlements, more portable, less platform coupling -- on my [fork](https://github.com/Jesssullivan/cmux).  

**qutebrowser** -- Improved FIDO2 supportability on my glab tinyland qutebrowser flake (which is tightly coupled with my local solr and searxng instances) which are fairly deviated from upstream at this point.  [Here is the FIDO2 PR and discussion upstream from coderkun](https://github.com/qutebrowser/qutebrowser/pull/8642)  

Iterating on some similar work in the keepassxc codebase as well. 

Basically, this passkey work has been somewhat spurred on because I picked up the new Apple [Neo](https://www.apple.com/macbook-neo/) to serve as a dedicated "teletype" for the wide array of servers in the basement in which (and on which, in the case of the BCI server) I do my work, contracting and projects.  As is tradition, all my widgets have been ceremoniously velcroed to this little macbook- between cmux, qutebrowser and my nix-based intellij gateway setup the little screen is all I need.  FIDO2 support makes it way easier to traverse orgs / glab instances / signing keys / this key store or that keystore / this server or that server etc.  

As far as the Neo goes, I'll begrudgingly say is a genuinely pleasant experience, total AlphaSmart vibes.  Just a terminal multiplexer with a good screen, a new battery, a good keyboard and a slab of velcro with little keys, two SDRs, 2 KVMs, 3 keystores, 3 hardware keys and a few adapters.  
