---
title: "Intro to the AWS Cloud 9 IDE"
date: "2018-04-10"
description: "The Cloud 9 IDE is the fastest way I have come up with to develop web-based or otherwise \"connected\" programs. Because it lives on a Linux-based EC2 server on..."
tags: ["DIY", "Featured", "Ideas", "How-To", "Reviews"]
published: true
slug: "intro-to-the-aws-cloud-9-ide"
original_url: "https://transscendsurvival.org/2018/04/10/intro-to-the-aws-cloud-9-ide/"
---

The Cloud 9 IDE is the fastest way I have come up with to develop web-based or otherwise "connected" programs. Because it lives on a Linux-based EC2 server on AWS, running different node, html, etc programs that rely on a network system just work- it is all already on a network anyway. 🙂 There is no downtime trying to figure out your WAMP, MAMP, Apache, or localhost situation.

Similarly, other network programs work just as well- I am running a MySQL server over here (RDS), storage over there (S3), and have various bits in Github and locally. Instead of configuring local editors, permissions, and computer ports and whatnot, you are modifying the VPC security policies and IAM groups- though generally, it just works.

**Getting going: The only prerequisite is you have an AWS account.** Students: get $40 EC2 dollars below:

https://aws.amazon.com/education/awseducate/[  
*What was once an image here is now just a memory of a URL.*](*The bits that made up this image have scattered to the wind.*)Open the cloud 9 tab under services.

Setup is very fast- just know if others are going to be editing to, understand the [IAM policies](https://aws.amazon.com/iam/) and what [VPC settings](https://aws.amazon.com/vpc/) you actually want.

*Gone with the WordPress -- this image no longer exists online.*Know this ideally a browser-based service; I have tried to come up with a reason a SSH connection would be better and didn't get any where.

For one person, micro is fine. Know these virtual "RAMs" and "CPUs" are generous....

*This image was a casualty of the WordPress migration.*The default network settings are set up for you. This follows good practice for one person; more than that (or if you are perhaps a far-travelling person) note these settings. They are always editable under the VPC and EC2 instance tabs.

*Another image lost in the great WordPress decommission.*

That's it! Other use things to know:

This is a linux machine maintained by Amazon. Packages you think should work and be up to date (arguably like any other linux machine I guess...) may not be. Check your basics like the NPM installer and versions of what your going to be working on, it very well may be different than what you are used to.

*The server that hosted this image has long since gone dark.*

**In the editor:**

You have two panels of workspace in the middle- shown is node and HTML. Everything is managed by tabs- all windows can have as much stuff as you want this way.

Below there is a "runner" (shown with all the default options!) and a terminal window. Off to the left is a generic file manager.

I hope this is useful, it sure is great for me.

-Jess

### _Related_
