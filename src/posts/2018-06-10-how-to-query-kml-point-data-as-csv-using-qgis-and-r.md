---
title: "How to Query KML point data as CSV using QGIS and R"
date: "2018-06-10"
description: "How to Query KML point data as CSV using QGIS and R Here you can see more than 800 points, each describing an observation of an individual bird. This data is..."
tags: ["Birding", "DIY", "Featured", "Ideas", "How-To"]
published: true
slug: "how-to-query-kml-point-data-as-csv-using-qgis-and-r"
original_url: "https://transscendsurvival.org/2018/06/10/how-to-query-kml-point-data-as-csv-using-qgis-and-r/"
---

How to Query KML point data as CSV using QGIS and R

![](https://i1.wp.com/transscendsurvival.org/wp-content/uploads/2018/06/Screen-Shot-2018-06-10-at-8.28.16-AM.png?resize=300%2C181&ssl=1)

Here you can see more than 800 points, each describing an observation of an individual bird. This data is in the form of KML, a sort of XML document from Google for spatial data.

I want to know which points have “pair” or “female” in the description text nodes using R. This way, I can quickly make and update a .csv in Excel of only the paired birds (based on color bands).

Even if there was a description string search function in Google Earth Pro (or other organization-centric GIS/waypoint software), this method is more

robust, as I can work immediately with the output as a data frame in R, rather than a list of results.

First, open an instance of QGIS. I am running ~2.8 on OSX. Add a vector layer of your KML.

![](https://i0.wp.com/transscendsurvival.org/wp-content/uploads/2018/06/Screen-Shot-2018-06-10-at-8.28.54-AM.png?resize=145%2C163&ssl=1)

“Command-A” in the point dialog to select all before import!

![](https://i2.wp.com/transscendsurvival.org/wp-content/uploads/2018/06/Screen-Shot-2018-06-10-at-8.30.07-AM.png?resize=300%2C153&ssl=1)

Next, under “Vector”, select “Merge vector layers” via Data Management Tools.

Select CSV and elect to save the file instead of use a temporary/scratch file (this is a common error).

**Open your csv in Excel for verification!********![](https://i0.wp.com/transscendsurvival.org/wp-content/uploads/2018/06/Screen-Shot-2018-06-10-at-8.32.27-AM.png?resize=445%2C215&ssl=1)**

**The R bit:**
    
    
    _# query for paired birds
    
    #EDIT:  Libraries
    library(data.table)
    library(tidyverse)_
    
    data &lt;- data.frame(fread("Bird_CSV.csv"))
    
    pair_rows &lt;- contains("pair", vars = data$description)
    
    fem_rows &lt;- contains("fem", vars = data$description)
    
    result &lt;- combine(pair_rows, fem_rows)
    
    result &lt;- data[result,]
    
    write_csv(result, "Paired_Birds.csv")

**Tada!**

![](https://i1.wp.com/transscendsurvival.org/wp-content/uploads/2018/06/Screen-Shot-2018-06-10-at-5.55.15-PM.png?resize=300%2C250&ssl=1)

**-Jess**

### _Related_
