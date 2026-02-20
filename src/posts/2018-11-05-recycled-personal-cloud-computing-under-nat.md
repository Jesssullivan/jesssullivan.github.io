---
title: "Recycled Personal \"Cloud Computing\" under NAT"
date: "2018-11-05"
description: "As many may intuit, I like the AWS ecosystem; it is easy to navigate and usually just works. ...However- more than 1000 dollars later, I no longer use AWS for..."
tags: ["DIY", "Featured", "Reviews"]
published: true
slug: "recycled-personal-cloud-computing-under-nat"
original_url: "https://transscendsurvival.org/2018/11/05/recycled-personal-cloud-computing-under-nat/"
---

As many may intuit, I like the AWS ecosystem; it is easy to navigate and usually just works.

...However- more than 1000 dollars later, I no longer use AWS for most things....

🙁 ****

**My goals:**

Selective sync: I need a unsync function for projects and files due to the tiny 256 SSD on my laptop (odrive is great, just not perfect for cloud computing.

Shared file system: access files from Windows and OSX, locally and remote

Server must be headless, rebootable, and work remotely from under a heavy enterprise NAT (College)

Needs more than 8gb ram

Runs windows desktop remotely for gis applications, (OSX on my laptop)

Have as much shared file space as possible: 12TB+

Server: recycled, remote, works-under-enterprise-NAT:

**Recycled Dell 3010 with i5:**[ https://www.plymouth.edu/webapp/itsurplus/](https://www.plymouth.edu/webapp/itsurplus/)

- Cost: $75 (+ ~$200 in windows 10 pro, inevitable license expense)
- free spare 16gb ram laying around, local SSD and 2TB HDD upgrades
- Does Microsoft-specific GIS bidding, can leave running without hampering productivity

**Resilio (bittorrent) Selective sync:** [https://www.resilio.com/individuals/](https://www.resilio.com/individuals/)

- Cost: $60
- p2p Data management for remote storage + desktop
- Manages school NAT and port restrictions well (remote access via relay server)

**Drobo 5c:**

Attached and syncs to 10TB additional drobo raid storage, repurposed for NTFS

  * Instead of EBS (or S3)

What I see: front end-

**Jump VNC Fluid service:** [https://jumpdesktop.com/](https://jumpdesktop.com/)

- Cost: ~$30
- Super efficient Fluid protocol, clients include chrome OS and IOS, (with mouse support!)
- Manages heavy NAT and port restrictions well
- GUI for everything, no tunneling around a CLI

  * Instead of Workspaces, EC2

**Jetbrains development suite:** [https://www.jetbrains.com/](https://www.jetbrains.com/) (OSX)

- Cost: FREE as a verified GitHub student user.
- PyCharm IDE, Webstorm IDE

  * Instead of Cloud 9

**Total (** extra**) spent:** ~$165

(Example: my AWS bill for only October was $262)

-Jess
