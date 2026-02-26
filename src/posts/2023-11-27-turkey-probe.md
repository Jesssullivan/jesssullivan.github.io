---
title: "Turkey Probe"
date: "2023-11-27"
description: "A spur-of-the moment turkey thermometer with dubious accuracy, questionable code and unhelpful complexity made of random gahbage. Uses Steinhart-Hart equation..."
tags: ["DIY"]
published: true
slug: "turkey-probe"
original_url: "https://www.transscendsurvival.org/2023/11/27/turkey-probe/"
feature_image: "/images/posts/esp_Turkey.jpeg"
category: "hardware"
---

![Turkey Probe](/images/posts/esp_Turkey.jpeg)

_A spur-of-the moment turkey thermometer with dubious accuracy, questionable code and unhelpful complexity made of random gahbage._

Uses Steinhart-Hart equation to estimate the temperature from the 8266's analog pin (this board has a single channel 10 bit ADC) produced by a 100k 104GT-2/104NT-4 thermistor using 10k pullup resistor. The ESP 8266 serves a real-time temperature readout via a websocket connection over the local network. Find this ridiculous project of mine on Github here: https://github.com/Jesssullivan/turkeyprobe

![Turkey Probe in action during thanksgiving](/images/posts/esp_Turkey.jpeg) | ![Just moments before thanksgiving](/images/posts/testESP.jpeg)
---|---
