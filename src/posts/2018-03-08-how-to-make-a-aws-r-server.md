---
title: "How to make a AWS R server"
date: "2018-03-08"
description: "When you need an R server and have lots of data to process, AWS is a great way to go. Sign up of the free tier and poke around! Creating an AWS Rstudio server:..."
tags: ["DIY", "Featured"]
published: true
slug: "how-to-make-a-aws-r-server"
original_url: "https://transscendsurvival.org/2018/03/08/how-to-make-a-aws-r-server/"
feature_image: "/images/posts/IMG_0431.jpg"
category: "tutorial"
---

When you need an R server and have lots of data to process, AWS is a great way to go. Sign up of the free tier and poke around!

**Creating an AWS Rstudio server:**

[https://aws.amazon.com/blogs/big-data/running-r-on-aws/](https://aws.amazon.com/blogs/big-data/running-r-on-aws/) \- using both the R snippet (works but the R core bits are NOT present and it will not work yet) and the JSON snippet provided

[https://www.rstudio.com/products/rstudio/download-server/](https://www.rstudio.com/products/rstudio/download-server/) \- the suite being installed

Follow most of the AWS blog AMI info, with the following items:

**AMI** : Amazon Linux 2 (more packages and extras v. standard)

  * t2.micro (free tier)
  * IAM policy follows AWS blog JSON snippet
  * Security Policy contains open inbound ports 22, 8787, 3838 (the latter two for R server specific communication)
  * Append user, username:password in the blog post’s initial r studio install text (pasted into the “advanced” text box when completing the AMI setup

**SSH into the EC2 instance**

sudo yum install –y https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm

sudo yum-config-manager --enable epel

sudo yum repolist

wget https://download2.rstudio.org/rstudio-server-rhel-1.1.423-x86_64.rpm

sudo yum update -y

sudo yum install -y R

sudo rstudio-server verify-installation

**Access the graphical R server:**

In a web browser, tack on “:8787” to the end of the Instance’s public “connect” link. If it doesn’t load a login window (but seems to be trying to connect to something) the security policy is probably being overzealous……..

**Notes on S3-hosted data:**

  * S3 data is easiest to use if it is set to be public.
  * There are s3-specific tools for R, accessible as packages from CRAN directly from the R interface
  * Note data (delimited text at least) hosted in S3 will behave differently than it does locally, e.g. spaces, “na”, “null” need to be “cleaned” in R before use.

There we have it!

-Jess
