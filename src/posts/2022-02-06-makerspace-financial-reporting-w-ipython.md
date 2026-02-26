---
title: "Makerspace financial reporting w/ ipython"
date: "2022-02-06"
description: "Visit this project on github here Merge PayPal & Membershipworks members in a sorta intelligent way to create kinda accurate financial reports Convert a PayPal..."
tags: ["DIY", "Featured"]
published: true
slug: "makerspace-financial-reporting-w-ipython"
original_url: "https://www.transscendsurvival.org/2022/02/06/makerspace-financial-reporting-w-ipython/"
feature_image: "/images/posts/orange-wood-ducks.jpg"
category: "software"
---

[_Visit this project on github here_](https://github.com/ithacagenerator/MembershipWorks-Migration)

  * Merge PayPal & Membershipworks members in a sorta intelligent way to create kinda accurate financial reports
  * Convert a PayPal transaction export into an upsert-able csv to import into membershipworks
  * Keep tabs on PayPal memberships as they become deprecated

(note, you'll need [nbconvert, pandoc, TeX to write to pdf](https://nbconvert.readthedocs.io/en/latest/))

#### _...If all goes well, the output will look something like:_

```
loaded **** paypal records
loaded ** existing membershipworks records
converted Date column to datetime objects
kept *** records processed between 01/01/22 and 22/11/21; discarded **** records
discarded **'s Donation Payment record for **, continuing...
discarded **'s PreApproved Payment Bill User Payment record for **, continuing...
** ** already in member list! continuing...
discarded ** **'s Payment Refund record for -**.00, continuing...
discarded ** **'s Donation Payment record for **.00, continuing...
exported: ** Members!
 - ** Standard Members
 - ** Offline Standard Members
 - ** Extra Members
 - ** Offline Extra Members
 ...to a membershipworks-readable format at ./csv/membershipworks_import.csv
```
