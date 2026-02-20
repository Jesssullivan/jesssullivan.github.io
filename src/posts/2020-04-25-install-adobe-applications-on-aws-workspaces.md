---
title: "Install Adobe Applications on AWS WorkSpaces"
date: "2020-04-25"
description: "By default, the browser based authentication used by Adobe’s Creative Cloud installers will fail on AWS WorkSpace instances. Neither the installer nor Windows..."
tags: ["Featured", "Ideas"]
published: true
slug: "install-adobe-applications-on-aws-workspaces"
original_url: "https://transscendsurvival.org/2020/04/25/install-adobe-applications-on-aws-workspaces/"
---

By default, the browser based authentication used by Adobe’s Creative Cloud installers will fail on AWS WorkSpace instances. Neither the installer nor Windows provide much in the way of useful error messages- here is how to do it!

[Charlie Brown Good Grief GIF](https://tenor.com/view/good-grief-charlie-brown-gif-10296718) from [Charliebrown GIFs](https://tenor.com/search/charliebrown-gifs)

Open Server Manager. Under “Local Server”, open the “Internet Explorer Enhanced Security Configuration”- *(mercy!)* - and turn it off.

*An image described as "Good Lord" was here, but has since vanished from the web.*

##### Tada! The sign on handoff from the installer→Browser→ back to installer will now work fine. xD

*Some images from the original WordPress post are no longer available.*
