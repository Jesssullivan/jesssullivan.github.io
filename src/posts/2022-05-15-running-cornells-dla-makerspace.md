---
title: "Running Cornell's DLA Makerspace"
date: "2022-05-15"
description: "Notes on managing the Cornell CALS Department of Landscape Architecture fabrication lab, building a community around rapid prototyping, and naming every machine in sight."
tags: ["cornell", "makerspace", "3d-printing", "fabrication", "cnc"]
published: true
slug: "running-cornells-dla-makerspace"
category: "hardware"
feature_image: "/images/posts/shopbot_tinkering.webp"
---

From 2021 through 2022 I managed the fabrication lab for Cornell's Department of Landscape Architecture in CALS. It was one of the best gigs I have had -- equal parts teaching, tinkering, and trying to keep students from crashing the ShopBot into the spoilboard at full send.

The lab had a solid lineup of equipment. Our 3D printers were a pair of Ultimaker S3s I named Ada and Greta, plus an S5 called Fender. The S3 twins were the workhorses for student projects, running almost nonstop during the semester. Fender handled the bigger jobs and the occasional dual-material print with PVA supports.

![Dual-material PVA and PLA print](/images/posts/PVA_PLA_Xinke.webp)

We also had a ShopBot Buddy 32 CNC router, which was probably the most intimidating machine in the space for newcomers. There is something about a spinning router bit on a gantry that commands a healthy respect. I spent a lot of time developing curricula around safe operation and toolpath basics, getting students comfortable enough to actually use the thing for their landscape architecture models and site furniture prototypes.

![ShopBot CNC router work](/images/posts/shopbot_tinkering.webp)

![CNC tooling and blade holder](/images/posts/blade_holder.webp)

The laser cutters were a pair of Epilog Edge 50W CO2 units -- Freddie and Vaux. Yes, I named all the machines. It helps when you are troubleshooting over Discord and someone says "Freddie is acting up" instead of "the laser cutter, no the other one." The Epilogs were fantastic for the kind of layered site models and topographic slices that landscape architecture students produce constantly.

![Multidimensional laser cut work](/images/posts/multidimensional_lasercuts.webp)

![Planar fabrication demos](/images/posts/planar_demos.webp)

## Building the Infrastructure

One of the first things I did was set up proper digital infrastructure for the space. I built [dlamaker.space](https://dlamaker.space), a Flask webapp that served as the lab's home base -- equipment status, booking, documentation, the works. I also set up a GitHub organization for sharing code and configs, a Discord server for async communication (which turned out to be way more useful than email for "hey is the laser free" type questions), and published custom Cura print profiles tuned for our specific machines and the materials we stocked.

The tooling side of things was interesting too. I was writing C++ for a tiler development project, doing parametric design work in OpenSCAD, CAD in Fusion 360, and vector work in Inkscape for laser cutting. The software stack for a fabrication lab is surprisingly deep once you start accounting for every step from design to machine output.

## The Broader Community

During this same period I was also serving as the 3D Printing Captain at Ithaca Generator, the local makerspace in town. The two roles fed each other nicely -- techniques and knowledge from one space would flow into the other. I was active in a bunch of open-source hardware communities at the time: Voron, RailCore, Doomcube, Positron, and contributing to Marlin firmware development.

![Voron 2.4r2 build](/images/posts/IG_Voron24r2.webp)

![RailCore printer](/images/posts/railcore.webp)

Building a Voron 2.4r2 from scratch teaches you things about motion systems and thermal management that you simply cannot learn from running stock printers. That kind of hands-on knowledge made me a better lab manager -- when something went wrong with Ada or Fender, I usually had a pretty good intuition for what was happening mechanically before I even opened the enclosure.

![Small-scale 3D printing projects](/images/posts/tiny_printer_projects.webp)

## Teaching Rapid Fabrication

The teaching component was the most rewarding part. DLA students and faculty came in with wildly varying levels of comfort with digital fabrication. Some had never touched a slicer, others were already pretty handy with Rhino and Grasshopper. My job was to meet everyone where they were and get them producing physical output as fast as possible.

I developed curricula covering the full rapid fabrication pipeline: from digital design through machine setup, material selection, post-processing, and iteration. The emphasis was always on iteration -- getting a first cut or print done quickly, evaluating it physically, and going back to the model. Landscape architecture benefits enormously from this workflow because there is no substitute for holding a physical site model in your hands and understanding the topography at scale.

## The Presentation

Here is the introductory presentation I put together for the lab, covering equipment, workflows, and community resources:

<iframe src="/papers/dla-makerspace-intro.pdf" class="w-full h-[600px] rounded-lg border border-surface-300" title="DLA Makerspace Introduction"></iframe>

## Looking Back

Managing the DLA Makerspace was a crash course in wearing many hats at once -- sysadmin, teacher, mechanic, community builder, and occasional firmware debugger. The combination of Cornell's academic environment with the scrappier maker community in Ithaca made for a really productive period. I learned as much from the students as they learned from me, which is probably the best thing you can say about any teaching role.
