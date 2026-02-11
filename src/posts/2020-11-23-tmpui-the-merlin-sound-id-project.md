---
title: "Merlin AI Demos!"
date: "2020-11-23"
description: "post updated 11/23/20 Demos, interpreter implementations & data ingress tools for annotating, interpreting, and deploying trained models. Visit the web demos..."
tags: ["Birding", "Featured", "Ideas"]
published: true
slug: "tmpui-the-merlin-sound-id-project-november-2020"
original_url: "https://transscendsurvival.org/2020/11/23/tmpui-the-merlin-sound-id-project/"
---

_post updated 11/23/20_

#### _Demos, interpreter implementations & data ingress tools for annotating, interpreting, and deploying trained models._

  * **[_Visit the web demos here_](https://merlinai.herokuapp.com/)**
  * **[_readme @ github.io_](https://jesssullivan.github.io/tmpUI/)**

## Web:

*The image "demos" didn't survive the WordPress migration.*   
_Visit audio demos on Heroku_ |  *"demos" -- the original image is no longer hosted anywhere we can find.*   
_Visit Leaflet.annotation demos on Heroku_  
---|---  
  
  
_Watch environment setup here_ |    
  
_Watch Leaflet.annotation demo here_  
  
## **Hack upon these demos:**
    
    
    # Clone:
    git clone --branch=master --depth=1 https://github.com/Jesssullivan/tmpUI && cd tmpUI
    
    ## Follow the prompts: ##
    npm run-script develop-web-demos
    

Demo | Description  
---|---  
[deploy/demos/spec_record_crop_dl](https://github.com/Jesssullivan/tmpUI/tree/master/demos)   
[deploy/demos/spec_record_crop_post](https://github.com/Jesssullivan/tmpUI/tree/master/demos) | Experiments with record --> crop --> classify --> download; both client-side & server-side classifications methods  
[deploy/demos/load_audio](https://github.com/Jesssullivan/tmpUI/tree/master/demos)   
[deploy/demos/spec_display](demos/spec_display.ts) | Experiment with Macaulay audio sources --> spectrogram  
[deploy/demos/spec_record_crop_v3](https://github.com/Jesssullivan/tmpUI/tree/master/demos)   
[deploy/demos/spec_record_v2](https://github.com/Jesssullivan/tmpUI/tree/master/demos)   
[deploy/demos/spec_record_v2](https://github.com/Jesssullivan/tmpUI/tree/master/demos) | Single page feature experiments  
[deploy/demos/webgl_init](https://github.com/Jesssullivan/tmpUI/tree/master/demos)   
[deploy/demos/deploy/demos/webgl_float_test](https://github.com/Jesssullivan/tmpUI/tree/master/demos)   
[deploy/demos/spec_record_v2](https://github.com/Jesssullivan/tmpUI/tree/master/demos) | Evaluate web client's capability for classification  
  
#### Notes:

_Configure Flask in`config.py`:_
    
    
    # config.py
    
    # `True` serves demos @ 127.0.0.1:5000 via node proxy (set `False` for production @ 0.0.0.0:80)
    devel = True
    
    # rebuild header + demo + footer html renders before serving anything (set `False` for production):
    prerender = True
    

  * `/` runs `webgl_init`, which figures out if the browser can or cannot make classifications and routes the client accordingly. 
    * _classification options:_
    * if browser cannot do classification (i.e. safari on mobile, webgl mediump not supported) recording is beamed up to `/uploader_standard` for processing
    * both POST destinations `/uploader_select` & `/uploader_standard` can also be operated from within browser as a multipart form

### Leaflet.annotation @ tmpUI:

*Where "demos" once appeared, only this note remains.*  
  
_Visit Leaflet.annotation Audio demo_ |  *The image of "demos" is no longer available.*  
  
_Visit Leaflet.annotation Photo demo_  
---|---  
  
  * _(Jess is still typifying Annotator source, hang tight)_

_Hack on Annotator:_
    
    
    #### develop-anno-demos:
    
    # packs annotator demos
    # generates unique openssl cert & key
    # serves annotator demos on node http-server
    
    npm run-script develop-anno-demos
    
    
    # pack only tool definitions @ `./src/annotator_tool.js:
    npm run-script build-anno-tool
    
    # pack only implementations of audio annotator @ `./demos/annotator_audio.ts:
    npm run-script build-anno-audio
    
    # pack only implementations of photo annotator @ `./demos/annotator_photo.ts:
    npm run-script build-anno-photo

Demo | Description  
---|---  
[deploy/demos/annotator_audio](demos/annotator_audio.ts) | Leaflet.annotator tool implementations for generating, labeling, exporting mel spectrogams as annotation data  
[deploy/demos/annotator_photo](demos/annotator_photo.ts) | Leaflet.annotator tool implementations for labeling & exporting photo annotations  
[deploy/src/annotator_tool](src/annotator_tool.js) | epic `Annotator_tool` entrypoint, contains class handler functions  
  
### Swift Native:
    
    
    # Hack on Swift stuff:
    npm run-script develop-swift-demos

  * _focusing on codepaths for:_

    * tflite interpreter
    * generating mel spectrograms
  * make sure `info.plist` has permissions for microphone access

  * **The entrypoint for Swift tests is`./swift/swift-pkgs-tmpui/swift-pkgs-tmpui/swift_pkgs_tmpuiApp.swift`**

  * _Toggle various interpreter experiments from entrypoint_

#### Other Linker Libraries:

_Project:_
    
    
    $(inherited)
    -force_load Pods/TensorFlowLiteSelectTfOps/Frameworks/TensorFlowLiteSelectTfOps.framework/TensorFlowLiteSelectTfOps
    -force_load Pods/TensorFlowLiteC/Frameworks/TensorFlowLiteC.framework/TensorFlowLiteC
    -force_load Pods/TensorFlowLiteC/Frameworks/TensorFlowLiteCCoreML.framework/TensorFlowLiteCCoreML
    -force_load Pods/TensorFlowLiteC/Frameworks/TensorFlowLiteCMetal.framework/TensorFlowLiteCMetal
    -ObjC
    -l"c++"

_Target:_
    
    
    -force_load Pods/TensorFlowLiteSelectTfOps/Frameworks/TensorFlowLiteSelectTfOps.framework/TensorFlowLiteSelectTfOps
    -force_load Pods/TensorFlowLiteC/Frameworks/TensorFlowLiteC.framework/TensorFlowLiteC
    -force_load Pods/TensorFlowLiteC/Frameworks/TensorFlowLiteCCoreML.framework/TensorFlowLiteCCoreML
    -force_load Pods/TensorFlowLiteC/Frameworks/TensorFlowLiteCMetal.framework/TensorFlowLiteCMetal
    -ObjC
    -l"c++"
    
    
    
    # niftily switch between xcode versions:
    sudo xcode-select --switch ~/Downloads/Xcode-beta.app

_Interpreter Operations:_

_Hack on fft functions:_  
_[_./etc/tone.py:_](https://github.com/Jesssullivan/tmpUI/blob/master/etc/tone.py)_
    
    
    ### copy from here:
    cp etc/tone.py .
    
    ### generate some .wav files for testing fft things:
    python3 tone.py
    
    ### ...you can also specify duration in seconds & frequency in Hz like so:
    python3 tone.py 5 440
    
    ### ...or just duration:
    python3 tone.py 2

_some fft-related links_

  * simplest (beware some typos)

    * https://stackoverflow.com/questions/32891012/spectrogram-from-avaudiopcmbuffer-using-accelerate-framework-in-swift
    * https://gist.github.com/jeremycochoy/45346cbfe507ee9cb96a08c049dfd34f
  * _"krafter" has a nice clear working sketch:_

    * https://stackoverflow.com/questions/11686625/get-hz-frequency-from-audio-stream-on-iphone/19966776#19966776
  * accelerate & apple docs:

    * https://developer.apple.com/documentation/accelerate/equalizing_audio_with_vdsp
    * https://developer.apple.com/documentation/accelerate/vdsp/fast_fourier_transforms
    * https://medium.com/better-programming/audio-visualization-in-swift-using-metal-accelerate-part-1-390965c095d7

### Scripts:
    
    
    # See ./package.json & ./scripts/ for additional scripts

_main scripts links:_

  * [**_develop-web-demos_**](https://github.com/Jesssullivan/tmpUI/blob/master/scripts/develop_web_demos.sh)
  * [**_develop-anno-demos_**](https://github.com/Jesssullivan/tmpUI/blob/master/scripts/develop_anno_demos.sh)
  * [**_develop-swift-demos_**](https://github.com/Jesssullivan/tmpUI/blob/master/scripts/develop_swift_demos.sh)

#### _local ssl:_
    
    
    # Generates local ssl certs for testing w/ node http-server:
    npm run-script sslgen
    
    # you can also provide a $DOMAIN argument like so:
    npm run-script sslgen hiyori
    # ...returns key `hiyori_key.pem` & cert `hiyori.pem`
    
    # ...or:
    sudo chmod +x scripts/sslgen.sh && ./scripts/sslgen.sh
    # osx is a bit more finicky

#### _tone generator:_
    
    
    ### available from here:
    cp etc/tone.py .
    
    ### generate some .wav files for testing fft things:
    python3 tone.py
    
    ### ...you can also specify duration in seconds & frequency in Hz like so:
    python3 tone.py 5 440
    
    ### ...or just duration:
    python3 tone.py 2

#### _removing stuff:_
    
    
    # clean up with:
    npm run-script clean all
    # ...and follow the instruction prompt
    
    # ...demo bundles:
    npm run-script clean-web-bundles
    
    # ...demo renders:
    npm run-script clean-web-renders

[etc, etc etc](https://github.com/Jesssullivan/tmpUI#misc-notes--additional-bits)

xD

-Jess

### _Related_
