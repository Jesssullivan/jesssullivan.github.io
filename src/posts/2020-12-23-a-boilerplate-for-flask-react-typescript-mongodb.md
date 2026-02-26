---
title: "some boilerplate code, ?, etc"
date: "2020-12-23"
description: "?:Some “freezing-cold-New-Hamshire-Winter” morning metal: Jess S. · Morning Metal 12.17.20 ?:Organization for Flask + React + Typescript + MongoDB using the..."
tags: ["Featured", "Ideas", "How-To"]
published: true
slug: "a-boilerplate-for-flask-react-typescript-mongodb"
original_url: "https://www.transscendsurvival.org/2020/12/23/a-boilerplate-for-flask-react-typescript-mongodb/"
feature_image: "/images/posts/IMG_0797-Edit.jpg"
---

## ?:

Some "freezing-cold-New-Hamshire-Winter" morning metal:

[Jess S.](https://soundcloud.com/jesssullivan "Jess S.") · [Morning Metal 12.17.20](https://soundcloud.com/jesssullivan/morning-metal-121720 "Morning Metal 12.17.20")

##

## ?:

**Organization for Flask + React + Typescript + MongoDB using the nifty[Blueprints](https://flask.palletsprojects.com/en/1.1.x/blueprints/) library.**

  * this project on [github is over here](https://github.com/Jesssullivan/Flask-Mongo-Authenticate)

__

_Setup:_

__

__

__

    # clone: git clone https://github.com/Jesssullivan/Flask-Mongo-Authenticate/ && cd Flask-Mongo-Authenticate  # venv: python3 -m venv api_venv source api_venv/bin/activate pip3 install -r requirements.txt  # node: npm install  # permiss: sudo chmod +x setup run  # configure (default values are provided too): ./setup  # have at it: ./run

* * *

### _Structure:_

    ├── api   ├── main     ├── auth       └── token authentication methods     ├── config       └── the ./setup script populates a new config.cfg file for Flask,           using the ##FIELDS## provided in config.cfg.sample     ├── tools       └── utilities for date/time, expression matching, the like     └── user       └── models.py defines the User() class       └── routes.py implements User() methods api/routes as a blueprint           (registered at /user/) ├── public   └── all hot reloading and whatnot is done from react-scripts at index.html └── src   └── insert client-side source here, hack away  xD       the thinking is one deal with compiling & serving production code elsewhere

* * *

_Notes:_

  * spawned from [Luke Peters work here](https://github.com/LukePeters/flask-mongo-api-boilerplate)

  * Only tested on Ubuntu with GNU utilities, YMMV
  * On Mac, please use GNU `sed`, see `./setup` for details

    # MongoDB & gnu sed for Mac: brew install gnu-sed brew tap mongodb/brew brew install mongodb-community@4.4
