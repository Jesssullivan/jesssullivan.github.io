---
title: "Turkey Probe"
date: "2023-11-27"
description: "A spur-of-the moment turkey thermometer with dubious accuracy, questionable code and unhelpful complexity made of random gahbage. Uses Steinhart-Hart equation..."
tags: ["DIY"]
published: true
slug: "turkey-probe"
original_url: "https://www.transscendsurvival.org/2023/11/27/turkey-probe/"
---

#### ![](https://i0.wp.com/www.transscendsurvival.org/wp-content/uploads/2023/11/Version0_Animated.gif?resize=480%2C270&ssl=1)

_A spur-of-the moment turkey thermometer with dubious accuracy, questionable code and unhelpful complexity made of random gahbage._

Uses Steinhart-Hart equation to estimate the temperature from the 8266’s analog pin (this board has a single channel 10 bit ADC) produced by a 100k 104GT-2/104NT-4 thermistor using 10k pullup resistor. The ESP 8266 serves a real-time temperature readout via a websocket connection over the local network. Find this ridiculous project of mine on Github here: https://github.com/Jesssullivan/turkeyprobe

![](https://i0.wp.com/raw.githubusercontent.com/Jesssullivan/TurkeyProbe/main/media/esp_Turkey.jpeg?w=676&ssl=1) _Turkey Probe in action during thanksgiving_ | ![](https://i0.wp.com/raw.githubusercontent.com/Jesssullivan/TurkeyProbe/main/media/testESP.jpeg?w=676&ssl=1) _Just moments before thanksgiving_  
---|---
