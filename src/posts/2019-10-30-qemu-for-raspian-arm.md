---
title: "QEMU for Raspian ARM!"
date: "2019-10-30"
description: "Updated 11/6/19 Visit the repo on Github here- https://github.com/Jesssullivan/QEMU-Raspian tested on Mac OSX 10.14.6 Emulates a variety of Raspian releases on..."
tags: ["DIY", "Featured", "Ideas"]
published: true
slug: "qemu-for-raspian-arm"
original_url: "https://transscendsurvival.org/2019/10/30/qemu-for-raspian-arm/"
---

_Updated 11/6/19_

Visit the repo on Github here-  
https://github.com/Jesssullivan/QEMU-Raspian

_tested on Mac OSX 10.14.6_

Emulates a variety of Raspian releases on proper ARM hardware with QEMU. 

**_Prerequisites:_**

QEMU and wget (OSX homebrew)
    
    
    brew install qemu wget

Get the Python3 CLI in this repo:
    
    
    wget https://raw.githubusercontent.com/Jesssullivan/USBoN/master/QEMU_Raspian.py

* * *

**_Usage:_**

After the first launch, it will launch from the persistent .qcow2 image. 

With no arguments & in a new folder, Raspian "stretch-lite" (no desktop environment) will be: 

  * downloaded as a zip archive with a release kernel 
  * unarchived --> to img 
  * converted to a Qcow2 with 8gb allocated as disk 
  * launched from Qcow2 as administrator 

    
    
    sudo python3 QEMU_Raspian.py 

**_Optional Arguments:_**

  * `` -h `` prints CLI usage help 
  * `` -rm `` removes ALL files added in dir with QEMU_Raspian.py 
  * `` stretch `` uses standard graphical stretch release with GUI 
  * ``stretchlite `` for stretchlite release [default!] 
  * `` buster `` for standard graphical buster release [YMMV] 
  * ``busterlite`` for busterlite release [YMMV] 

    
    
    # examples:
    sudo python3 QEMU_Raspian.py busterlite
    python3 QEMU_Raspian -h  # print help

* * *

**_Burn as .img:_**
    
    
    qemu-img convert -f qcow2 -O raw file.qcow2 file.img

*The image of "Four Pi Emulations ala QEMU" is no longer available.*

### _Related_
