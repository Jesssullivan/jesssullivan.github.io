---
title: "The eBird API & regionCode"
date: "2020-06-14"
description: "get this script and other GIS bits here on github The Ebird dataset is awesome. While directly handling data as a massive delimited file- as distributed by the..."
tags: ["Birding", "Featured", "Ideas"]
published: true
slug: "the-ebird-api-regioncode"
original_url: "https://transscendsurvival.org/2020/06/14/the-ebird-api-regioncode/"
feature_image: "/images/posts/IMG_5415-2.jpg"
---

[_get this script and other GIS bits here on github_](https://github.com/Jesssullivan/GIS_Shortcuts)

The [Ebird dataset](https://ebird.org/science/download-ebird-data-products) is awesome. While directly handling data as a **massive** delimited file- as distributed by [the eBird people-](https://ebird.org/data/download) is cumbersome at best, the [ebird api](https://documenter.getpostman.com/view/664302/S1ENwy59?version=latest#e18ea3b5-e80c-479f-87db-220ce8d9f3b6) offers a fairly straightforward and efficient alternative for a few choice bits and batches of data.

  * The eBird `AWK` tool for filtering the actual delimited data can be [found over here](https://cornelllabofornithology.github.io/auk/):

``install.packages("auk")``

It is worth noting R + `auk` (or frankly any R centered filtering method) will quickly become limited by the single-threaded approach of R, and how you're managing memory as you iterate. Working and querying the data from a proper database quickly becomes necessary.

Most conveniently, the [eBird API already exists-](https://documenter.getpostman.com/view/664302/S1ENwy59?version=latest#e18ea3b5-e80c-479f-87db-220ce8d9f3b6) snag an [key over here](https://ebird.org/api/keygen).

...The API package for R is [over here](https://cran.r-project.org/web/packages/rebird/index.html):
``install.packages("rebird")``

...There is also a neat Python wrapper [over here](https://pypi.org/project/ebird-api/):
``pip3 install ebird-api``

**_Region Codes:_**

I'm not sure why, but some methods use normal latitude / longitude in decimal degrees while some others use `"regionCode"`, which seems to be some kind of eBird special. Only ever seen this format in ebird data.

For example, recent observations uses `regionCode`:

```text
# GET Recent observations in a region:
# https://api.ebird.org/v2/data/obs/REGIONCODE/recent
```

...But nearby recent observations uses latitude / longitude:

```text
# GET Recent nearby observations:
# https://api.ebird.org/v2/data/obs/geo/recent?lat=LAT&lng=LNG
```

Regardless, lets just write a function to convert decimal degrees to this `regionCode` thing. Here's mine:

```python
#!/usr/bin/env python3
"""
# provide latitude & longitude, return eBird "regionCode"
Written by Jess Sullivan
@ https://transscendsurvival.org/
available at:
https://raw.githubusercontent.com/Jesssullivan/GIS_Shortcuts/master/regioncodes.py
"""
import requests
import json

def get_regioncode(lat, lon):

    # this municipal api is a publicly available, no keys needed afaict
    census_url = str('https://geo.fcc.gov/api/census/area?lat=' +
                     str(lat) +
                     '&lon=' +
                     str(lon) +
                     '&format=json')

    # send out a GET request:
    payload = {}
    get = requests.request("GET", census_url, data=payload)

    # parse the response, all api values are contained in list 'results':
    response = json.loads(get.content)['results'][0]

    # use the last three digits from the in-state fips code as the "subnational 2" identifier:
    fips = response['county_fips']

    # assemble and return the "subnational type 2" code:
    regioncode = 'US-' + response['state_code'] + '-' + fips[2] + fips[3] + fips[4]
    print('formed region code: ' + regioncode)
    return regioncode
```
