---
title: "Deploy Shiny R apps along Node.JS"
date: "2018-11-25"
description: "Find the tools in action on Heroku as a node.js app! https://kml-tools.herokuapp.com/ See the code on GitHub: https://github.com/Jesssullivan/Shiny-Apps After..."
tags: ["DIY", "Featured", "How-To"]
published: true
slug: "deploy-shiny-r-apps-along-node-js"
original_url: "https://transscendsurvival.org/2018/11/25/deploy-shiny-r-apps-along-node-js/"
feature_image: "/images/posts/img_8694.jpg"
---

**Find the tools in action on Heroku as a node.js app!**

[https://kml-tools.herokuapp.com/](https://kml-tools.herokuapp.com/)

**See the code on GitHub:**

[https://github.com/Jesssullivan/Shiny-Apps](https://github.com/Jesssullivan/Shiny-Apps)

After many iterations of ideas regarding deployment for a few research Shiny R apps, I am glad to say the current web-only setup is 100% free and simple to adapt. I thought I'd go through some of the Node.JS bits I have been fussing with.

**The Current one:**

Heroku has a free tier for node.js apps. See the pricing and limitations here: [https://www.heroku.com/pricing](https://www.heroku.com/pricing) as far as I can tell, there is little reason to read too far into a free plan; they don’t have my credit card, and thy seem to convert enough folks to paid customers to be nice enough to offer a free something to everyone.

Shiny apps- [https://www.shinyapps.io/](https://www.shinyapps.io/)\- works straight from RStudio. They have a free plan. Similar to Heroku, I can care too much about limitations as it is completely free.

The reasons to use Node.JS (even if it just a jade/html wrapper) are numerous, though may not be completely obvious. If nothing else, Heroku will serve it for free….

Using node is nice because you get all the web-layout-ux-ui stacks of stuff if you need them. Clearly, I have not gone to many lengths to do that, but it is there.

Another big one is using node.js with Electron. [https://electronjs.org/](https://electronjs.org/) The idea is a desktop app framework serves up your node app to itself, via the chromium. I had a bit of a foray with Electron- the node execa `npm install execa` package let me launch a shiny server from electron, wait a moment, then load a node/browser app that acts as a interface to the shiny process. While this _mostly_ worked, it is definitely overkill for my shiny stuff. Good to have as a tool though.

-Jess
