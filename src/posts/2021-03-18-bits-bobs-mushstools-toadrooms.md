---
title: "Bits & Bobs, Mushstools & Toadrooms"
date: "2021-03-18"
description: "…Despite being a chilly & wintery March up here in the White Mountains, there is no shortage of fun birds and exciting projects! So many Redpolls are keeping..."
tags: []
published: true
slug: "bits-bobs-mushstools-toadrooms"
original_url: "https://www.transscendsurvival.org/2021/03/18/bits-bobs-mushstools-toadrooms/"
---

...Despite being a chilly & wintery March up here in the White Mountains, there is no shortage of fun birds and exciting projects! 

  * So many [Redpolls](https://www.allaboutbirds.org/guide/Common_Redpoll/id) are keeping the [Juncos](https://www.allaboutbirds.org/guide/Dark-eyed_Junco/id) company this year! Two pairs of Hooded Mergansers moved in just next door last week! 

  * **_Use_** [**_AWS S3 as a Joplin sync target!_**](https://github.com/laurent22/joplin/pull/4675/files#diff-b335630551682c19a781afebcf4d07bf978fb1f8ac04c6bf87428ed5106870f5R266)

  * Local [Sharp-shinned hawks](https://www.allaboutbirds.org/guide/Sharp-shinned_Hawk/id) & [Fluffy Red Foxes](https://en.wikipedia.org/wiki/Red_fox) have been busy careening around town gobbling up prey left and right- they seem to know Spring is right around the corner! 

#### Merlin AI pipeline for Mushroom identification!

_It's happening, and its going to be awesome_ [**_visit this project over here on GitHub_**](https://github.com/Jesssullivan/image-identifer)
    
    
    git clone https://github.com/Jesssullivan/image-identifer/ && cd image-identifer

**_Overview:_**

  * **Setup**
  * **Artifacts**
  * **Preprocess**
  * **Artifacts**
  * **Train**
  * **Structures**
  * **Notes**

#### 

### _Setup:_
    
    
    # venv:
    python3 -m venv mushroomobserver_venv
    source mushroomobserver_venv/bin/activate
    pip3 install -r requirements.txt

#### 

**_Artifacts:_** | [_train.tgz_](https://mo.columbari.us/static/train.tgz) | [_test.tgz_](https://mo.columbari.us/static/test.tgz)  
---|---|---  
[_images.tgz_](https://mo.columbari.us/static/images.tgz) | [_images.json_](https://mo.columbari.us/static/images.json) | [_gbif.zip_](https://mo.columbari.us/static/gbif.zip)  
  
* * *

#### 

### _Preprocess:_
    
    
    python3 preprocess

  * Fetches & saves off gbif archive to `./static/`
    * Checks the archive, tries loading it into memory etc
  * Fetches Leaflet Annotator binary & licenses from [JessSullivan/MerlinAI-Interpreters](https://github.com/Jesssullivan/MerlinAI-Interpreters); Need to commit annotator _(as of 03/16/21)_ , still fussing with a version for Mushroom Observer 
  * Generates an `images.json` file from the 500 assets selected by Joe & Nathan
  * Downloads, organizes the 500 selected assets from _images.mushroomoberver.org_ at `./static/images/<category>/<id>.jpg`
    * writes out images archive
  * More or less randomly divvies up testing & training image sets 
    * writes out example testing/training archives; (while training it'll probably be easier to resample directly from images.tgz from keras)

### _Train:_
    
    
    python3 train

  * Fetches, divvies & shuffles train / validation sets from within Keras using archive available at [_mo.columbari.us/static/images.tgz_](https://mo.columbari.us/static/images.tgz)
  * More or less running Google's demo transfer learning training script in `train/training_v1.py` as of _03/17/21_ , still need to bring in training operations and whatnot from merlin_ai/ repo --> experiment with Danish Mycology Society's ImageNet v4 notes

**_Google Colab:_**

  * [@gvanhorn38](https://github.com/gvanhorn38/) pointed out Google Colabs's neat Juptyer notebook service will train models for free if things are small enough- I have no idea what the limits are- fiddle with their [**_intro to image classification on Google Colab here_**](https://colab.research.google.com/github/tensorflow/docs/blob/master/site/en/tutorials/images/classification.ipynb), its super cool!

**_Jupyter:_**

  * One may also open and run notebooks locally like this:

    * [rendered pdf version available over here](https://github.com/Jesssullivan/image-identifer/blob/main/train/notebook/training_v1.pdf)
    * rename ipython notebook: 
          
          cp train/notebook/training_v1.ipynb.bak train/notebook/training_v1.ipynb

    * launch jupyter: 
          
          jupyter notebook

    * or without authentication: 
          
          jupyter notebook --ip='*' --NotebookApp.token='' --NotebookApp.password ''

  *     * -

#### 

### _Structures:_

  * _Leaflet Annotator`images.json` Structure:_

    * **id** : _taxonID_ The MO taxon id
    * **category_id** : The binomen defined in the `./static/sample_select_assets.csv`; for directories and URIs this is converted to snake case.
    * **url** : Temporary elastic ip address this asset will be available from, just to reduce any excessive / redundant traffic to _images.mushroomobserver.org_
    * **src** : _imageURL_ The asset's source URL form Mushroom Observer 
          
          [&#123;
          "id": "12326",
          "category_id": "Peltula euploca",
          "url": "https://mo.columbari.us/static/images/peltula_euploca/290214.jpg"
          "src": "https://images.mushroomobserver.org/640/290214.jpg"
          &#125;]

  * _Selected asset directory structure:_
        
        ├── static
        ├── gbif.zip
        ├── images
        |   ...
        │   └── peltula_euploca
        │       ├── 290214.jpg
        │       ...
        │       └── 522128.jpg
        │   ...
        ├── images.json
        ├── images.tgz
        ├── js
        │   ├── leaflet.annotation.js
        │   └── leaflet.annotation.js.LICENSE.txt
        └── sample_select_assets.csv
        ...

  *     * -

#### 

#### _Notes:_

_Fiddling with the archive:_

  * `MODwca.gbif[1].id`: Integer: This is the Mushroom Observer taxon id, e.g.

    * `https://mushroomobserver.org/13`
    * `https://images.mushroomobserver.org/640/13.jpg`
  * `MODwca.gbif[1].data:`: Dictionary: DWCA row data, e.g.

    * `MODwca.gbif[1].data['http://rs.gbif.org/terms/1.0/gbifID']` = `13`
    * `MODwca.gbif[1].data['http://rs.tdwg.org/dwc/terms/recordedBy']` = `Nathan Wilson`
