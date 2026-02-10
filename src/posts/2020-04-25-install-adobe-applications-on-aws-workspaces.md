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

![Good Lord](https://i0.wp.com/transscendsurvival.org/wp-content/uploads/2020/04/Screenshot-from-2020-04-25-12-46-12.png?resize=200%2C123&ssl=1)

##### Tada! The sign on handoff from the installer→Browser→ back to installer will now work fine. xD

![](https://i1.wp.com/transscendsurvival.org/wp-content/uploads/2020/04/Screenshot-from-2020-04-25-12-43-14-e1587835606433-300x167.png?resize=200%2C100&ssl=1)

### _Related_
