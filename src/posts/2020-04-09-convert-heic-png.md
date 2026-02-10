---
title: "Convert .heic -> .png"
date: "2020-04-09"
description: "on github here, or just get this script: wget https://raw.githubusercontent.com/Jesssullivan/misc/master/etc/heic_png.sh Well, following the current course of..."
tags: ["Featured", "Ideas", "How-To"]
published: true
slug: "convert-heic-png"
original_url: "https://transscendsurvival.org/2020/04/09/convert-heic-png/"
---

[_on github here_](https://github.com/Jesssullivan/misc/blob/master/etc/heic_png.sh), _or just get this script:_
    
    
    wget https://raw.githubusercontent.com/Jesssullivan/misc/master/etc/heic_png.sh

Well, following the current course of Apple’s corporate brilliance, iOS now defaults to .heic compression for photos. 

Hmmm. 

Without further delay, let's convert these to png, here from the sanctuary of Bash in [♡Ubuntu Budgie♡](https://ubuntubudgie.org/downloads/). 

[_Libheif is well documented here on Github BTW_](https://github.com/strukturag/libheif)
    
    
    #!/bin/bash
    # recursively convert .heic to png
    # by Jess Sullivan
    #
    # permiss:
    # sudo chmod u+x heic_png.sh
    #
    # installs heif-convert via ppa:
    # sudo ./heic_png.sh
    #
    # run as $USER:
    # ./heic_png.sh
    
    command -v heif-convert >/dev/null || &#123;
    
      echo >&2 -e "heif-convert not intalled! \nattempting to add ppa....";
    
      if [[ $EUID -ne 0 ]]; then
         echo "sudo is required to install, aborting."
         exit 1
      fi
    
      add-apt-repository ppa:strukturag/libheif
      apt-get install libheif-examples -y
      apt-get update -y
    
      exit 0
    
      &#125;
    
    # default behavior:
    
    for fi in *.heic; do
    
      echo "converting file: $fi"
    
      heif-convert $fi $fi.png
    
     # FWIW, convert to .jpg is faster if png is not required 
     # heif-convert $fi $fi.jpg
    
      done

### _Related_
