---
title: "(beta) - How to build \"The Phone Charger\""
date: "2016-12-15"
description: "Imagine, any AA or 9v battery could charge your phone and other USB gadgets. Behold, the LM780! This is a voltage regulator chip. Stick between 5 and, say, 9..."
tags: ["DIY", "How-To"]
published: true
slug: "beta-how-to-build-the-phone-charger"
original_url: "https://transscendsurvival.org/2016/12/15/beta-how-to-build-the-phone-charger/"
---

Imagine, any AA or 9v battery could charge your phone and other USB gadgets. Behold, the LM780!

This is a voltage regulator chip. Stick between 5 and, say, 9 volts in one end and huzzah! (about) 5 volts pops out the other end. these cost a few dimes and can be had on ebay 10 for 4$.

Below is the BOM: (to make 10 chargers!)

Sourced via ebay:

$4: 10x of LM780 5v

$4: 10x of little toggle switches

$4: 10x of 9v snap connectors (I used a 6v supply from AAs but as far as the chip is concerned it doesn't matter to much. (I am reading 4.~ volts and enough power to charge a phone out of mine now)

$0: PCB- Technically they aren't even needed, but for our uses they make the soldering and building more straightforward.

$1: 10x of USB A ports from China

$?: Casing- be creative. I want to make one in a shrink-wrapped tube or 3d printed box or something.

**First, lay the parts out like so:**

...notice how when facing the shiny side of the chip, the left leg is in line with the left hand side of the USB port when looking into the port:

![](https://i2.wp.com/localhost/wp-content/uploads/2016/12/IMG_1679-300x225.jpg?resize=300%2C225)

Then arrange them like so:

...Notice I squished the power wires under the bent pins. RED GOES TO THE PIN ON THE RIGHT when facing the shiny side, and BLACK GOES TO THE MIDDLE ONE.

...The remaining leg is attached to the far left pin on the USB port (when facing the chip's shiny side remember).

![](https://i1.wp.com/localhost/wp-content/uploads/2016/12/IMG_1677-300x225.jpg?resize=300%2C225)

Then it works!! YAY!

![](https://i1.wp.com/localhost/wp-content/uploads/2016/12/IMG_1680-300x225.jpg?resize=300%2C225)

Here I verify it works by charging my commercial usb charger with my DIY duct tape one:

![](https://i1.wp.com/localhost/wp-content/uploads/2016/12/Screen-Shot-2016-12-14-at-8.05.43-PM-294x300.png?resize=294%2C300)

Good luck!

### _Related_
