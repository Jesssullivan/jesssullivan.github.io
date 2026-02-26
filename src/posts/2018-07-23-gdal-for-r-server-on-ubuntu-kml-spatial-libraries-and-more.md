---
title: "GDAL for R Server on Ubuntu - KML Spatial Libraries and More"
date: "2018-07-23"
description: "GDAL for R Server on Red Hat Xenial Ubuntu - KML Spatial Libraries and More If you made the (possible mistake) of running with a barebones Red Hat Linux..."
tags: ["DIY", "Ideas"]
published: true
slug: "gdal-for-r-server-on-ubuntu-kml-spatial-libraries-and-more"
original_url: "https://transscendsurvival.org/2018/07/23/gdal-for-r-server-on-ubuntu-kml-spatial-libraries-and-more/"
feature_image: "/images/posts/img_8694.jpg"
category: "tutorial"
---

**GDAL for R Server on Red Hat Xenial Ubuntu - KML Spatial Libraries and More**

If you made the (possible mistake) of running with a barebones Red Hat Linux instance, you will find it is missing many things you may want in R. I rely on GDAL (the definitive Geospatial Data Abstraction Library) on my local OSX R setup, and want it on my server too. GDAL contains many libraries you need to work with KML, RGDAL, and other spatial packages. It is massive and usually take a long time to sort out on any machine.

These notes assume you are already involved with a R server (usually port 8787 in a browser). I am running mine from an EC2 instance with AWS.

! Note this is a fresh server install, using Ubuntu; I messed up my original ones while trying to configure GDAL against conflicting packages. If you are creating a new one, opt for at least a T2 medium (or go bigger) and find the latest Ubuntu server AMI. For these instructions, you want an OS that is as generic as possible.

On Github:

https://github.com/Jesssullivan/rhel-bits

**From Bash:**

# SSH into the EC2 instance: (here is the syntax just in case)

#ssh -i "/Users/YourSSHKey.pem" ec2-user@yourAWSinstance.amazonaws.com

sudo su -

apt-get update

apt-get upgrade

nano /etc/apt/sources.list

#enter as a new line at the bottom of the doc:

deb https://cloud.r-project.org/bin/linux/ubuntu xenial/

#exit nano

wget https://raw.githubusercontent.com/Jesssullivan/rhel-bits/master/xen-conf.sh

chmod 777 xen-conf.sh

./xen-conf.sh

**Or...**

From SSH:

# SSH into the EC2 instance: (here is the syntax just in case)

ssh -i "/Users/YourSSHKey.pem" ec2-user@yourAWSinstance.amazonaws.com

# if you can, become root and make some global users- these will be your access to

# RStudio Server and shiny too!

sudo su –

adduser &lt;Jess>

# Follow the following prompts carefully to create the user

apt-get update

nano /etc/apt/sources.list

# enter as a new line at the bottom of the doc:

deb https://cloud.r-project.org/bin/linux/ubuntu xenial/

# exit nano

# Start, or try [bash](https://github.com/Jesssullivan/rhel-bits):

apt-get install r-base

apt-get install r-base-dev

apt-get update

apt-get upgrade

wget http://download.osgeo.org/gdal/2.3.1/gdal-2.3.1.tar.gz

tar xvf gdal-2.3.1.tar.gz

cd gdal-2.3.1

# begin making GDAL: this all takes a while

./configure [if your need proper kml support (like me), search on configuring with expat or libkml. There are many more options for configuration based on other packages that can go here, and this is the step to get them in order...]

sudo make

sudo make install

cd # Try entering R now and check the version!

# Start installing RStudio server and Shiny

apt-get update

apt-get upgrade
sudo apt-get install gdebi-core
wget https://download2.rstudio.org/rstudio-server-1.1.456-amd64.deb
sudo gdebi rstudio-server-1.1.456-amd64.deb

# Enter R or go to the graphical R Studio installation in your browser

R

# Authenticate if using the graphical interface using the usr:pwd you defined earlier

# this will take a long time

install.packages(“rgdal”)

# Note any errors carefully!

Then:

install.packages(“dplyr”)

install.packages(c("data.table", "tidyverse”, “shiny”) # etc

##### Well, there you have it!

-Jess

**Extras:**

**##Later, ONLY IF you NEED Anaconda, FYI:**

# Get Anaconda: this is a large package manager, and is could be used for patching up missing # dependencies:

#Use "ls" followed by rm -r &lt;anaconda> (fill in with ls results) to remove conflicting conda

# installers if you have any issue there, I am starting fresh:

mkdir binconda

# *making a weak attempt at sandboxing the massive new package manager installation*

cd binconda
wget [http](https://repo.continuum.io/archive/Anaconda2-5.2.0-Linux-x86_64.sh)[://repo.continuum.io/archive/Anaconda2-4.3.0-Linux-x86_64.sh](https://repo.continuum.io/archive/Anaconda2-5.2.0-Linux-x86_64.sh)
# install and follow the prompts
bash Anaconda2-5.2.0-Linux-x86_64.sh

# Close the terminal window completely and start a new one, and ssh back to where you left

# off. Conda install requires this.

# open and SSH back into your instance. You should now have either additional flexibility in

# either patching holes in dependencies, or created some large holes in your server. YMMV.

### Done

**Red Hat stuff:**

Follow these AWS instructions if you are doing something else:

https://aws.amazon.com/blogs/big-data/running-r-on-aws/

See my notes on this here:

https://transscendsurvival.org/2018/03/08/how-to-make-a-aws-r-server/

and notes on Shiny server:

https://transscendsurvival.org/2018/07/16/deploy-a-shiny-web-app-in-r-using-aws-ec2-red-hat/

GDAL on Red Hat:- Existing threads on this:

https://gis.stackexchange.com/questions/120101/building-gdal-with-libkml-support/120103#120103

This is a nice short thread about building from source:

https://gis.stackexchange.com/questions/263495/how-to-install-gdal-on-centos-7-4

neat RPM package finding tool, just in case:

https://rpmfind.net/linux/rpm2html/

Info on the LIBKML driver if you end up with issues there:

http://www.gdal.org/drv_libkml.html

I hope this is useful- GDAL is important and best to set it up early. It will be a pain, but so is losing work while trying to patch it in later. xD

-Jess
