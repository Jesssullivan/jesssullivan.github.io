---
title: "Querying KML Point Data with QGIS and R"
date: "2019-03-10"
description: "A walkthrough for converting ~800 KML bird observation points to CSV via QGIS, then querying and filtering with R using data.table and stringr."
tags: ["gis", "r", "qgis", "kml", "data-wrangling"]
published: true
slug: "querying-kml-data-with-qgis-and-r"
category: "software"
---

This semester I have been working with Dr. Leonard Reitsma at Plymouth State University on warbler territory research, and one of the recurring tasks is wrangling GPS point data collected in the field. We have roughly 800 point observations of banded birds stored as KML files -- the kind of thing Google Earth spits out -- and I needed a reliable way to pull specific subsets of those observations for analysis. The full tutorial PDF is embedded below, but here is the gist of the workflow.

## KML to CSV via QGIS

KML is great for visualization but not so great for programmatic querying. The first step is getting the data into a flat format. In QGIS, you can drag a KML file straight into the layers panel, then right-click the layer and export it as a CSV. Make sure to check the "Add saved file to map" option so you can verify the export looks right. The attribute table should preserve all the descriptive fields from the original KML -- bird ID, band colors, sex, pairing status, location notes, and so on.

Nothing fancy here, just `Layer > Export > Save Features As... > CSV`. The key thing is that the geometry (lat/lon) gets written into the CSV columns so you can reference it later if needed.

## Loading and Querying in R

Once you have a CSV, R makes quick work of filtering. I have been using `data.table::fread` because it is fast and handles messy field data well:

```r
library(data.table)
library(stringr)

obs <- fread("warbler_observations.csv")
```

From there, say you want to find all observations of paired females. The description fields in these KML exports tend to be free-text, so pattern matching is the way to go. You can use `stringr::str_detect` for this:

```r
paired_females <- obs[str_detect(Description, "paired") & str_detect(Description, "female"), ]
```

Or if you prefer staying within `data.table` syntax, the `%like%` operator works:

```r
paired_females <- obs[Description %like% "paired" & Description %like% "female"]
```

Both approaches get you the same result. I tend to reach for `str_detect` when the patterns get more complex (regex support is cleaner), but `%like%` is perfectly fine for simple substring matches.

## Writing Filtered Results

Once you have your subset, writing it back out is straightforward:

```r
library(readr)
write_csv(paired_females, "paired_females_obs.csv")
```

That filtered CSV can go right back into QGIS or ArcGIS for mapping, or into whatever downstream analysis you are running. In our case, we were feeding these subsets into territory mapping workflows -- more on that in the [succession warblers and GIS post](/blog/succession-warblers-and-gis) from later that spring.

## Why This Matters

When you are dealing with field data at this scale -- hundreds of GPS points with free-text attribute descriptions -- you need a pipeline that lets you slice the data quickly without manually scrolling through spreadsheets. The QGIS-to-R workflow here is simple but it saved a lot of time during the research season. It also made it easy to generate specific datasets for the [AAG poster](/aag) we put together.

The full step-by-step tutorial is below if you want to follow along with your own KML data.

<iframe src="/papers/kml-qgis-r-tutorial.pdf" class="w-full h-[600px] rounded-lg border border-surface-300" title="How to Query KML Point Data as CSV using QGIS and R"></iframe>

Cheers,

-- Jess
