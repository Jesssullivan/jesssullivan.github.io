---
title: "INFO: Deploy a Shiny web app in R using AWS (EC2 Red Hat)"
date: "2018-07-16"
description: "Info on deploying a Shiny web app in R using AWS (EC2 Redhat) As a follow-up to my post on how to create an AWS RStudio server, the next logical step is to..."
tags: ["DIY", "Featured", "Ideas"]
published: true
slug: "deploy-a-shiny-web-app-in-r-using-aws-ec2-red-hat"
original_url: "https://transscendsurvival.org/2018/07/16/deploy-a-shiny-web-app-in-r-using-aws-ec2-red-hat/"
---

**Info on deploying a Shiny web app in R using AWS (EC2 Redhat)**

As [a follow-up to my post on how to create an AWS RStudio server](https://transscendsurvival.org/2018/03/08/how-to-make-a-aws-r-server/), the next logical step is to host some useful apps you created in R for people to use. A common way to do this is the R-specific tool Shiny, which is built in to RStudio. Learning the syntax to convert R code into a Shiny app is rather subtle, and can be hard. I plan to do a more thorough demo on this- particularly the use of the $ symbol, as in “input$output”- later. 🙂

It turns out hosting a Shiny Web app provides a large number of opportunities for things to go wrong…. I will share what worked for me. All of this info is accessed via SSH, to the server running Shiny and RStudio.

I am using the AWS “Linux 2” AMI, which is based on the Red Hat OS. For reference, here is some extremely important Red Hat CLI language worth being familiar with and debugging:

“**sudo yum install** ” and “**wget** ” are for fetching and installing things like shiny. Don’t bother with instructions that include “apt-get install”, as they are for a different Linux OS!

“**sudo chmod -R 777** ” is how you change your directory permissions for read, write, and execute (all of those enabled). This is handy if your server disconnecting when the app tries to run something- it is a simple fix to a problem not always evident in the logs. The default root folder from which shiny apps are hosted and run is “**/srv/shiny-server** ” (or just “**/srv** ” to be safe).

“**nano /var/log/shiny-server.log** ” is the location of current shiny logs.

“**sudo stop shiny-server** ” followed by “**sudo start shiny-server** ” is the best way to restart the server- “sudo restart shiny-server” is not a sure bet on any other process. It is true, other tools like a node.js server or nginx could impact the success of Shiny- If you think nginx is a problem, “**cd /ect/nginx** ” followed by “**ls** ” will get you in the right direction. Others have cited problems with Red Hat not including the directories and files at “/etc/nginx/sites-available”. You do not need these directories. (though they are probably important for other things).

“**sudo rm -r** ” is a good way to destroy things, like a mangled R studio installation. Remember, it is easy enough to start again fresh! 🙂

“**sudo nano /etc/shiny-server/shiny-server.conf** ” is how to access the config file for Shiny. The fresh install version I used _did not work_! There will be lots of excess in that file, much of which can causes issues in a bare-bones setup like mine. One important key is to ensure Shiny is using a root user- see my example file below. I am the root user here (jess)- change that to mirror- at least for the beginning- the user defined as root in your AWS installation. See my notes HERE on that- that is defined in the advanced settings of the EC2 instance.

BEGIN CONFIG FILE: *(the download link for this config file has been lost with the WordPress site)* *Download is properly indented

`  
# Define user: this should be the same user as the AWS root user!  
#  
run_as jess;  
#  
# Define port and where the home (/) directory is  
# Define site_dir/log_dir - these are the defaults  
#  
server&#123;  
listen 3838;  
location / &#123;  
site_dir /srv/shiny-server;  
log_dir /var/log/shiny-server;  
directory_index on;  
&#125;  
&#125;  
`

END CONFIG FILE

Well, the proof is in the pudding. At least for now, you can access a basic app I made that cleans csv field data files that where entered into excel by hand. They start full of missing fields and have a weird two-column setup for distance- the app cleans all these issues and returns a 4 column (from 5 column) csv.

Download the test file here: *the test CSV file is no longer available -- it was hosted on the old WordPress site*

And access the app here: [ Basic Shiny app on AWS!](http://ec2-34-228-197-7.compute-1.amazonaws.com:3838/sample-apps/Clean/)

Below is an iFrame into the app, just to show how very basic it is. Give it a go!  
﻿

-Jess

### _Related_
