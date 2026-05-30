---
title: "Gingersnap Cookies (from a milk-free, soy-free recipe card)"
date: "2026-05-29"
description: "A milk-free, soy-free, egg-free Gingersnap Cookies recipe card, OCR'd with Apple Vision and checked against the photo- with metric equivalents, a batch scaler, and the baking soda chemistry that makes it rise."
tags: ["recipe", "baking", "baking-science", "cookies", "gingersnap", "allergen-friendly", "ocr", "apple-vision", "swift", "llvm", "macos"]
category: "tutorial"
published: true
slug: "gingersnap-cookies"
excerpt: "A milk-free, soy-free gingersnap recipe card, transcribed from a photo with Apple Vision OCR, metric equivalents, a scaler, and notes on the baking soda reaction."
feature_image: "/images/posts/gingersnap-cookies.webp"
thumbnail_image: "/images/posts/gingersnap-cookies.webp"
---

<script>
	import GingersnapScaler from '$lib/components/GingersnapScaler.svelte';
</script>

A recipe card. Milk-free, soy-free, egg-free gingersnaps, with **"good"** written across the top in pen.

It's from the *Cookies & Snacks* section of an allergen cookbook. The corner is stamped with the book's free-from legend, `P, S, N`, and the recipe uses milk-free, soy-free margarine with no eggs.

I photographed the card, ran a first pass through Apple's Vision OCR, then checked the output against the photo line by line. The recipe below keeps the card's wording and adds metric volume and weight equivalents.

![A stained, dog-eared recipe card titled Gingersnap Cookies from the Cookies and Snacks section, with the word good handwritten across it in pen](/images/posts/gingersnap-cookies.webp)

## Amount scaler

<GingersnapScaler />

## Verbatim transcription

**Ingredients** — as written on the card, with metric equivalents (volume · weight):

- ¾ cup milk-free, soy-free margarine — *177 ml · 170 g*
- 1 cup brown sugar, packed — *237 ml · 213 g*
- ¼ cup molasses — *59 ml · 85 g*
- 2 Tbsp orange juice — *30 ml · ~31 g*
- 2¼ cups all-purpose flour — *532 ml · 270 g*
- 2 tsp baking soda — *10 ml · 12 g*
- ½ tsp salt — *2.5 ml · 3 g*
- 1 tsp ground ginger — *5 ml · ~2 g*
- 1 tsp ground cinnamon — *5 ml · ~3 g*
- 1 tsp ground cloves — *5 ml · ~2 g*
- granulated sugar, for rolling — *~¼ cup · ~50 g*

**Method**

1. Preheat oven to 375°F (190°C). Grease cookie sheets.
2. Cream the margarine, brown sugar, molasses, and orange juice.
3. In a separate bowl, sift together the flour, baking soda, salt, ginger, cinnamon, and cloves.
4. Stir the dry ingredients into the molasses mixture.
5. Form into small balls. Roll in granulated sugar, then place 2 inches apart on the greased cookie sheets.
6. Bake for 12 minutes.

Makes about 5 dozen cookies.

## How it rises without eggs or butter

The baking soda is the leavener. Sodium bicarbonate needs moisture and acid to release carbon dioxide. [Baking Sense](https://www.baking-sense.com/baking-school/baking-science/ingredients/baking-powder-baking-soda/) lists molasses and citrus juice as acidic ingredients that trigger the reaction, and notes that unneutralized soda can leave a soapy, bitter flavor.

Here, the molasses and orange juice do that job without eggs or dairy. The gram weights above come from [King Arthur's ingredient weight chart](https://www.kingarthurbaking.com/learn/ingredient-weight-chart).

## Digitizing the card- Apple Vision OCR

I used Apple's **Vision** framework (`VNRecognizeTextRequest`) for the first OCR pass and checked the result manually.

1. `sips` to turn the iPhone HEIC into a PNG for Vision:
   ```sh
   sips -s format png IMG_4509.HEIC --out recipe.png
   ```
2. Run the Swift program below over the PNG.
3. Reconcile its output against the photo by eye.

<details open>
<summary><strong>Apple Vision OCR in ~40 lines of Swift (VNRecognizeTextRequest, accurate mode)</strong></summary>

```swift
import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else {
    FileHandle.standardError.write("usage: ocr <image>\n".data(using: .utf8)!)
    exit(1)
}
let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write("cannot load image\n".data(using: .utf8)!)
    exit(1)
}

let request = VNRecognizeTextRequest { req, _ in
    guard let obs = req.results as? [VNRecognizedTextObservation] else { return }
    // Sort top-to-bottom, then left-to-right, so the reading order survives.
    let sorted = obs.sorted { a, b in
        if abs(a.boundingBox.midY - b.boundingBox.midY) > 0.02 {
            return a.boundingBox.midY > b.boundingBox.midY
        }
        return a.boundingBox.midX < b.boundingBox.midX
    }
    for o in sorted {
        if let top = o.topCandidates(1).first { print(top.string) }
    }
}
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.customWords = ["molasses", "tsp", "tbsp", "cloves", "granulated", "margarine"]

let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try handler.perform([request])
```

Vision returns text observations with normalized bounding boxes, not a finished reading order. Sorting by `midY` (descending- Vision's origin is bottom-left) and then `midX` rebuilds the card order; `customWords` keeps cooking terms like *molasses* from being autocorrected away.

</details>

That produced the card text in one pass- title, ingredient columns, method paragraph, and fractions.

### Footer: building it with the LLVM/Swift toolchain

No package manager involved. The OCR API lives in Apple's `Vision.framework`, and the compiler is the Swift toolchain from Xcode command-line tools.

```sh
# What's under the hood — swiftc is an LLVM frontend, bundled with clang:
$ swift --version
Apple Swift version 6.3.2 (swiftlang-6.3.2.1.108 clang-2100.1.1.101)
Target: arm64-apple-macosx26.0
```

Two ways to run it. Interpret the script:

```sh
swift ocr.swift recipe.png
```

Or compile an optimized native binary:

```sh
# -O turns on LLVM's optimizer; link the two system frameworks we touch.
swiftc -O ocr.swift -o ocr -framework Vision -framework AppKit
./ocr recipe.png
```

That `swiftc` invocation is the whole pipeline: Swift source → **SIL** (Swift's own IR) → **LLVM IR** → the LLVM backend emits `arm64` machine code for the `arm64-apple-macosx` target, linked against the system frameworks. The bundled `clang` shares the same LLVM.
