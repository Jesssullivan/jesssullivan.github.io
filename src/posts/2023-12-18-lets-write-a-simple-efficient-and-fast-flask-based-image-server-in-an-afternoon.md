---
title: "Lets write a simple, efficient and fast flask-based image server in an afternoon"
date: "2023-12-18"
description: "….that uses lanczos resampling to serve optimized cached photos. Find this project on GitHub here: jesssullivan/FastPhotoAPI Interact with this API graphically..."
tags: ["Featured", "Ideas"]
published: true
slug: "lets-write-a-simple-efficient-and-fast-flask-based-image-server-in-an-afternoon"
original_url: "https://www.transscendsurvival.org/2023/12/18/lets-write-a-simple-efficient-and-fast-flask-based-image-server-in-an-afternoon/"
feature_image: "/images/posts/IMG_0872.jpg"
---

….that uses lanczos resampling to serve optimized cached photos.

Find this project on GitHub here: [jesssullivan/FastPhotoAPI](https://github.com/Jesssullivan/FastPhotoAPI)

Interact with this API graphically here (hosted on [koyeb](https://www.koyeb.com/docs) via Docker): https://api.birdphoto.website/

**Structure:**

This application adopts the factory pattern; `flask run` instantiates the built-in development server by executing `create_app()` at the root of the `app/` package, while `python application.py` creates a new production application, served by waitress.

    git clone https://github.com/Jesssullivan/FastPhotoAPI && cd FastPhotoAPI
    python3.12 -m venv fast_photo_venv
    source fast_photo_venv/bin/activate
    pip install -r requirements.txt

**Structure:**

    ├── app
    ├── __init__.py # create and serve development application
    └── main
    ├── config
    │ │ └── config.cfg # set directories, max image dimensions, etc
    │ ├── fullsize
    │ │ └── routes.py # Blueprint routing for serving verbatim image files
    │ ├── __init__.py # `create_app()` entrypoint
    │ ├── resampled
    │ │ ├── model.py # Image resampling methods
    │ │ └── routes.py # Blueprint routing for `/image/`
    │ └── static
    │ └── routes.py # Blueprint routing for `/static/`
    ├── application.py # create and serve production application w/ waitress
    ├── cache # resampled images are dynamically generated adn stored here
    ├── Dockerfile # currently deployed at Koyeb
    ├── pictures # full res pictures go here
    ├── README.md # you are here
    ├── static
    │ └── style.css # index styling
    └── templates
    ├── index.html
    └── upload.html

**Build** :

_Locally**:**_

    _# dev WSGI:_ flask run # 0.0.0.0:5000

    # _waitress WSGI:_ flask run # 0.0.0.0:8000

    _Production via Docker:_
    ## build production docker image:
    # docker build -t &lt;srv>.

    ## serve production docker image locally:
    docker run -d -p 8000:8000 &lt;srv>:latest

    ## stop local image:
    # docker ps
    # docker stop

    ## push image to a container registery:
    # docker push &lt;srv>

**Basic Usage:
** – Fetch a resampled & cached image ``/image/<yourimage>``
– Fetch the original, unmodified image ``/full/<yourimage>``
