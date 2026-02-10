---
title: "Persistent, Live Ubuntu for College"
date: "2019-08-04"
description: "Below is are live mirrors of my \"PSU Hacking Club\" Ubuntu repos. https://github.com/psu-hacking/iso-gen https://psuhacking.club/..."
tags: ["DIY"]
published: true
slug: "persistent-live-ubuntu-for-college"
original_url: "https://transscendsurvival.org/2019/08/04/persistent-live-ubuntu-for-college/"
---

**Below is are live mirrors of my "PSU Hacking Club" Ubuntu repos.**

* * *

[_https://github.com/psu-hacking/iso-gen_](https://github.com/psu-hacking/iso-gen)

* * *

[_https://psuhacking.club/_](https://psuhacking.club/)

[_https://github.com/psu-hacking/static-site_](https://github.com/psu-hacking/static-site)

# Simple File Hosting

* * *

**_README yet to be updated with Makerspace-specific formatting_**

* * *

Static site built quickly with [Hugo CLI](https://gohugo.io/getting-started/quick-start/)
    
    
    # on OSX
    # get hugo
    
    brew install hugo
    
    # clone site
    
    git clone https://github.com/psu-hacking/static-site
    cd static-site
    
    # Compile and compress public directory
    
    hugo
    zip -r site-archive.zip public
    
    # upload and host with sftp & ssh
    
    sftp user@yoursite.net
    > cd yoursite.net
    > put site-archive.zip
    
    # new terminal window
    
    ssh user@yoursite.net
    # check your remote filesystem- the idea is:
    > unzip site-archive.zip
    > rm -rf yoursite.net/site-archive.zip
    

[visit us](https://psuhacking.club)

* * *

#### [Also, check out the evolving PSU Hacking Club wiki here!](https://github.com/psu-hacking/home-wiki/wiki/Developer-Student-Software)

xD - Jess

### _Related_
