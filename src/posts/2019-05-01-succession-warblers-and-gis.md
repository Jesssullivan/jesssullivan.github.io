---
title: "Succession, Warblers, and GIS"
date: "2019-05-01"
description: "GIS fieldwork mapping warbler territories in managed forest patch cuts in Canaan, NH with Dr. Leonard Reitsma at Plymouth State University."
tags: ["gis", "ornithology", "arcmap", "fieldwork", "ecology"]
published: true
slug: "succession-warblers-and-gis"
feature_image: "/images/posts/merlin_mics.webp"
category: "software"
---

For the past couple of field seasons I have been working with Dr. Leonard Reitsma at Plymouth State University studying warbler species distribution in managed forest patch cuts up in Canaan, NH. The work sits right at the intersection of GIS, ecology, and a lot of early mornings standing in regenerating clear cuts trying to pin down territorial birds with a handheld GPS.

The basic question we were after: how do different warbler species partition space in and around patch cuts at various stages of forest succession? The focal species were Common Yellowthroat (COYE), Chestnut-sided Warbler (CSWA), Magnolia Warbler (MAWA), and Black-throated Blue Warbler (BTBW). Each of these species has different habitat preferences tied to vegetation structure, so the patchwork of regenerating cuts, edges, and intact forest creates a natural experiment in how birds sort themselves out across a landscape.

The data collection workflow was straightforward but tedious. We tracked individual birds (many of them color-banded) using a combination of a handheld Garmin GPS and an iPhone running Compass 55 for quick waypoint drops. Every observation of a territorial male got a GPS point with notes on behavior, band combo if visible, and what the bird was doing. Over the course of a season this adds up to hundreds of points per site.

All the spatial data lived as KML files, which is Google's XML-based format for geographic data. KML is convenient for field collection and visualization in Google Earth, but it is not the friendliest format for analysis. I put together a companion tutorial on converting KML point data to CSV using QGIS and R, which is available as a [PDF here](/papers/kml-qgis-r-tutorial.pdf). The short version: import the KML as a vector layer in QGIS, merge and export to CSV, then use R to query and filter the data by description fields. This made it much easier to pull out subsets of observations for specific birds or behaviors.

For the spatial analysis itself, I used ArcMap to run kernel density estimates on the point data, which gives you a heat map of where each species was concentrating its activity. More interesting was the convex hull analysis -- drawing minimum bounding polygons around all the observations of a single bird to approximate its territory, then overlaying those territories on the patch cut polygons. This let us look at how individual territories related to the cut boundaries and whether birds were setting up shop inside the cuts, along the edges, or in the surrounding mature forest.

The results lined up with what you would expect from the ecology. COYE and CSWA, both early-successional specialists, were concentrated inside the younger patch cuts with dense shrubby regrowth. MAWA showed up more in intermediate-aged cuts where young conifers were filling in. BTBW, a mature forest bird, mostly stayed out in the surrounding intact canopy but occasionally pushed into the edges of older cuts. The kernel density maps made these patterns visually obvious in a way that point maps alone do not.

This work fed directly into a presentation at the 2019 AAG Annual Meeting in Washington, DC. You can find the [poster and related materials on the AAG page](/aag). The research was also connected to some other collaborative work with Dr. Reitsma -- around the same time, we published a paper in the Northeastern Naturalist documenting Black-capped Chickadees feeding Hermit Thrush nestlings (Reitsma, Burns & Sullivan, 2019), which came out of observations during the same field seasons in Canaan.

The full GIS presentation is embedded below:

<iframe src="/papers/gis-warblers-2019.pdf" class="w-full h-[600px] rounded-lg border border-surface-300" title="Succession, Warblers, and GIS"></iframe>

Looking back, this project was where I really started to appreciate how much of field ecology is actually data management. The birds are the fun part, but the hours spent cleaning KML files, troubleshooting coordinate reference systems in ArcMap, and writing R scripts to wrangle waypoint descriptions into usable data frames -- that is where most of the work happens. It also got me thinking seriously about better tooling for field data collection, which eventually led to some of the software projects I picked up later.

-- Jess
