---
title: "When it must be Windows...."
date: "2020-03-17"
description: "Edit 07/26/2020: Check out the expanded GIS notes page here! Regarding Windows-specific software, such as ArcMap: Remote Desktop: The greatest solution I've..."
tags: ["Ideas", "How-To"]
published: true
slug: "when-it-must-be-windows"
original_url: "https://transscendsurvival.org/2020/03/17/when-it-must-be-windows/"
---

_Edit 07/26/2020:_  
[Check out the expanded GIS notes page here!](https://jesssullivan.github.io/GIS_Shortcuts/)

**_Regarding Windows-specific software, such as ArcMap:_**

_Remote Desktop:_  
The greatest solution I've settled on for ArcMap use continues to be [Chrome Remote Desktop](https://remotedesktop.google.com/home), coupled with an [IT Surplus](https://www.plymouth.edu/webapp/itsurplus/) desktop purchased for ~$50. Once Chrome is good to go on the remote Windows computer, one can operate everything from a web browser from anywhere else (even reboot and share files to and from the remote computer). While adding an additional, dedicated computer like this may not be possible for many students, it is certainly the simplest and most dependable solution. 

_VirtualBox, Bootcamp, etc:_  
[Oracle's VirtualBox](https://www.virtualbox.org/wiki/Downloads) is a longstanding (and free!) virtualization software. A Windows virtual machine is vastly preferable over [Bootcamp](https://support.apple.com/boot-camp) or further [partition tomfoolery](https://www.digitalocean.com/community/tutorials/how-to-partition-and-format-storage-devices-in-linux).  
One can start / stop the VM only when its needed, store it on a usb stick, avoid [insane pmbr issues](https://www.transscendsurvival.org/2019/02/27/mac-osx-fixing-gpt-and-pmbr-tables/), etc. 

  * Bootcamp will consume at least 40gb of space at all times before even attempting to function, whereas even a fully configured Windows VirtualBox VDI will only consume ~22gb, and can be moved elsewhere if not in use. 
  * There are better (not free) virtualization tools such as [Parallels](https://www.parallels.com/), though any way you slice it a dedicated machine will almost always be a better solution. 

**Setup & Configure VirtualBox:**

  * [Install VirtualBox- link](https://www.virtualbox.org/wiki/Downloads)
  * [Download a Windows 10 ISO- link](https://www.microsoft.com/en-us/software-download/windows10ISO)

There are numerous sites with VirtualBox guides, so I will not go into detail here.

_Extra bits on setup-_

  * [Guest Additions](https://www.virtualbox.org/manual/ch04.html) are not necessary, despite what some folks may suggest. 

  * Dynamically Allocated VDI is the way to go as a virtual disk. There is no reason not to set the allocated disk size to the biggest value allowed, as it will never consume any more space than the virtual machine actually needs. 

  * Best to click through all the other machine settings just to see what is available, it is easy enough to make changes over time.

  * There are many more levels of convoluted not worth stooping to, ranging from ArcMap via [AWS EC2](https://aws.amazon.com/ec2/) or [openstack](https://www.openstack.org/) to [KVM/QEMU](https://www.linux-kvm.org/page/Main_Page) to [WINE](https://www.winehq.org/about). _Take it from me_

**_xD_**

### _Related_
