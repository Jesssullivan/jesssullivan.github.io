---
title: "Quick fix: 254 character limit in ESRI Story Map?"
date: "2018-09-12"
description: "https://gis.stackexchange.com/questions/75092/maximum-length-of-text-fields-in-shapefile-and-geodatabase-formats https://en.wikipedia.org/wiki/GeoJSON..."
tags: ["Featured", "Ideas", "How-To"]
published: true
slug: "quick-fix-254-character-limit-in-esri-story-map"
original_url: "https://transscendsurvival.org/2018/09/12/quick-fix-254-character-limit-in-esri-story-map/"
feature_image: "/images/posts/IMG_1221-Edit.jpg"
---

https://gis.stackexchange.com/questions/75092/maximum-length-of-text-fields-in-shapefile-and-geodatabase-formats

https://en.wikipedia.org/wiki/GeoJSON

https://gis.stackexchange.com/questions/92885/ogr2ogr-converting-kml-to-geojson

If you happened to be working with.... KML data (or any data with large description strings) and transitioning it into the ESRI Story Map toolset, there is a very good chance you hit the the dBase 254 character length limit with the ESRI Shapefile upload. Shapefiles are always a terrible idea.

the solution: with GDAL or QGIS (alright, even in ArcMap), one can use GeoJSON as an output format AND import into the story map system- with complete long description strings!

**QGIS:**

Merge vector layers -> save to file -> GeoJSON

**arcpy:**
import arcpy

import os

arcpy.env.workspace = "/desktop/arcmapstuff"

arcpy.FeaturesToJSON_conversion(os.path.join("outgdb.gdb", "myfeatures"), "output.json")

**GDAL:
**&lt;
ogr2ogr -f GeoJSON output.json input.kml
