---
title: "Week Notes: Cyborgs, Servers, and Sending"
date: "2026-03-04"
description: "Bifurcation woes on a jumped-up Dell 7810, BCI goggles on my face, tcfs gets native macOS FileProvider support, Dhall eats Ansible for breakfast, and Tuesday sends."
tags: ["weeknotes", "homelab", "bci", "xoxdwm", "tcfs", "dhall", "climbing", "metal", "reverse-engineering"]
published: true
feature_image: "/images/posts/IMG_2125.jpg"
slug: "week-notes-cyborgs-servers-and-sending"
---

## Trash Computing: Dell 7810 Bifurcation Saga

The struggles of lane splitting for multiple NVMe drives via an [80G5N breakout card](https://www.dell.com/support/home/en-us/drivers/driversdetails?driverid=8h1nw) on my jumped-up Dell 7810 have been more complex than expected. PCIe bifurcation — convincing the BIOS to split x16 lanes into x4/x4/x4/x4 for individual NVMe drives — is never straightforward on workstation hardware that predates the NVMe-everything era.

I already modified this server to run multiple PSUs (went from a ~685W PSU to drawing **2300 watts** at full bore). This machine's job is split between being a BCI HID development box and participating in various ridiculous network experiments. Current internals:

- **GPU**: AMD Radeon RX 9070 XT — graphics for the goggles
- **NIC**: Intel 82599ES 10GbE — for networking experiments
- **IO**: 100 channels of analog serial for sensors, measurement, and clocking hardware

The [T7810A34.exe BIOS update](https://www.dell.com/support/home/en-us/drivers/driversdetails?driverid=8h1nw) was a necessary stop on this journey.

## BCI Goggles: Laced Up and On My Face

The [BS2e](https://www.bigscreenvr.com/) goggles are laced up to the BCI server and strapped to my head. I'm developing against the BS2e headset in conjunction with the [OpenBCI Ganglion](https://openbci.com/) and the [Babble](https://github.com/SummerSigh/ProjectBabble) VR mouth tracking project to bring my evil plans to reality, or something. I do not play videogames.

Continued development on **XoxdWM**, a completely bespoke WM/DE for cyborgs inspired by [Stanislav Aleksandrov's VR development for the KDE ecosystem](https://alexandrov-music.de/). Originally forked from [EXWM](https://github.com/ch11ng/exwm).

## Norwegian Metal in the Office

Soundtrack for the week:

- [Firestarter mixtape](https://youtu.be/Igg__Pmj-nk?si=0y8pXlgEd7HpNkyE) — a classic
- [Sirena — *The 13th Floor*](https://tidal.com/album/167019555/u) (album)
- [Immortal — *Northern Chaos Gods*](https://tidal.com/album/107059333/u) (album)

## Tuesday Evening: Indoor Rock Climbing

Warmed up on a fun chimney climb. Iterated on a **5.13 top rope project**. Rest of the evening on lead belay duty with the [Petzl Neox](https://www.petzl.com/US/en/Sport/Belay-Devices-And-Descenders/technical-content-product/NEOX) — assisted braking for lead belay that actually feeds smoothly.

## TummyCryptFileSystem Gets macOS FileProvider

After great consternation and headbanging, [tcfs](https://github.com/nicholasgasior/tcfs) now has native, notarized [FileProvider](https://developer.apple.com/documentation/fileprovider) support for Darwin targets. Tcfs now graces the darned work Macs in my life — no macFUSE needed.

## Dhall Eats Ansible for Breakfast

Since grabbing [Dhall](https://dhall-lang.org/) by the bullhorns a few weeks ago, I've refactored down **over 4,000 lines** of Ansible and Tofu code this week. Typed configuration languages: they work.

## Reverse Engineering Corner

The use of [Ghidra](https://ghidra-sre.org/) and [Frida](https://frida.re/) to completely disassemble and instrument corpo products for fun will continue until morale improves.
