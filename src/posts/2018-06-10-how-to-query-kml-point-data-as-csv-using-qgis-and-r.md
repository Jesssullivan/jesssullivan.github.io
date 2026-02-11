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

![](/images/posts/Screen-Shot-2018-06-10-at-8.28.16-AM.png)

Here you can see more than 800 points, each describing an observation of an individual bird. This data is in the form of KML, a sort of XML document from Google for spatial data.

I want to know which points have “pair” or “female” in the description text nodes using R. This way, I can quickly make and update a .csv in Excel of only the paired birds (based on color bands).

Even if there was a description string search function in Google Earth Pro (or other organization-centric GIS/waypoint software), this method is more

robust, as I can work immediately with the output as a data frame in R, rather than a list of results.

First, open an instance of QGIS. I am running ~2.8 on OSX. Add a vector layer of your KML.

![](/images/posts/Screen-Shot-2018-06-10-at-8.28.54-AM.png)

“Command-A” in the point dialog to select all before import!

![](/images/posts/Screen-Shot-2018-06-10-at-8.30.07-AM.png)

Next, under “Vector”, select “Merge vector layers” via Data Management Tools.

Select CSV and elect to save the file instead of use a temporary/scratch file (this is a common error).

**Open your csv in Excel for verification!********![](/images/posts/Screen-Shot-2018-06-10-at-8.32.27-AM.png)**

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

![](/images/posts/Screen-Shot-2018-06-10-at-5.55.15-PM.png)

**-Jess**

### _Related_
