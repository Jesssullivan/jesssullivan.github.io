---
title: "Week Notes: Cyborgs, Servers, and Sending"
date: "2026-03-04"
description: "Dell 7810 bifurcation woes, BCI goggles laced up, tcfs gets macOS FileProvider, 4k lines of Ansible replaced with Dhall, 5.13 top rope project, and Norwegian metal in the office."
tags: ["weeknotes", "homelab", "bci", "xoxdwm", "tcfs", "dhall", "climbing", "metal", "reverse-engineering"]
category: "personal"
published: true
slug: "week-notes-cyborgs-servers-and-sending"
author_slug: "jesssullivan"
feature_image: "/images/posts/IMG_2125.jpg"
tinyland_projection: true
tinyland_projection_snapshot: "jesssullivan-github-io-posts-pulse-static-2026-05-10"
tinyland_projection_snapshot_hash_prefix: "sha256:3ff059b493f5"
tinyland_projection_source: "content/users/jesssullivan/blog/week-notes-cyborgs-servers-and-sending.md"
tinyland_projection_source_hash_prefix: "sha256:13a16d0211d9"
---
![Cyborg lab: goggles, server guts, drives](/images/posts/IMG_2125.jpg)

## Trash Computing

[T7810A34.exe](https://www.dell.com/support/home/en-us/drivers/driversdetails?driverid=8h1nw) and trash computing: bifurcation woes and continued server bending on a jumped up Dell 7810. The struggles of lane splitting for multiple NVMe drives via [80G5N breakout card](https://www.dell.com/support/home/en-us/drivers/driversdetails?driverid=8h1nw) have been more complex than I expected.

I already modified this server to run multiple PSUs (went from ~685 watt PSU to drawing 2300 watts at full bore).

This machine's job is split between being a BCI HID development box (interfaces with 100 channels of analog serial IO for sensors and measurement, some clocking hardware, a 9070 XT GPU to do graphics things with the goggles, a 82599ES for networking) and participating in various ridiculous network experiments.

## BCI Goggles

[BS2e](https://www.bigscreenvr.com/) goggles are laced up to the BCI server and my face!

I am developing against the BS2e headset in conjunction with [OpenBCI Ganglion](https://openbci.com/) and [Babble](https://github.com/SummerSigh/ProjectBabble) VR mouth tracking project to bring my evil plans to reality, or something. I do not play videogames.

Continued development on **XoxdWM**, a completely bespoke WM/DE for cyborgs inspired by [Stanislav Aleksandrov's VR development for the KDE ecosystem](https://invent.kde.org/plasma/kwin/-/merge_requests/8671). Originally forked from [EXWM](https://github.com/ch11ng/exwm).

## Norwegian Metal in the Office

- [Firestarter mixtape](https://youtu.be/Igg__Pmj-nk?si=0y8pXlgEd7HpNkyE) — a classic!
- [Sirena — *The 13th Floor*](https://tidal.com/album/167019555/u) (album)
- [Immortal — *Northern Chaos Gods*](https://tidal.com/album/107059333/u) (album)

## Tuesday Evening: Indoor Rock Climbing

- Warmed up on a fun chimney climb.
- Iterated on a 5.13 top rope project.
- Rest of the evening on lead belay duty with the [Petzl Neox](https://www.petzl.com/US/en/Sport/Belay-Devices-And-Descenders/technical-content-product/NEOX).

## tcfs

After great consternation and headbanging, my TummyCryptFileSystem (tcfs) now has native, notarized [FileProvider](https://developer.apple.com/documentation/fileprovider) support for Darwin targets, whoot whoot. Tcfs now graces the darned work Macs in my life, no macFUSE needed.

## Dhall

Since grabbing [Dhall](https://dhall-lang.org/) by the bullhorns a few weeks ago, I've refactored down over 4 thousand lines of Ansible and Tofu code this week.

## Reverse Engineering

The use of [Ghidra](https://ghidra-sre.org/) and [Frida](https://frida.re/) to completely disassemble and instrument corpo products for fun will continue until morale improves.
