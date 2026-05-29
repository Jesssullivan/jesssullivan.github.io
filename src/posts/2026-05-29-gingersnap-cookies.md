---
title: "Gingersnap Cookies (from a milk-free, soy-free recipe card)"
date: "2026-05-29"
description: "An old milk-free, soy-free, egg-free Gingersnap Cookies recipe card, OCR'd with Apple Vision and transcribed faithfully- with metric volume + weight equivalents, an interactive batch scaler, and the acid/base chemistry that makes it rise without eggs or dairy."
tags: ["recipe", "baking", "baking-science", "cookies", "gingersnap", "allergen-friendly", "ocr", "apple-vision", "swift", "llvm", "macos"]
category: "tutorial"
published: true
slug: "gingersnap-cookies"
excerpt: "A stained lil recipe card for milk-free, soy-free gingersnaps- someone scrawled 'good' across it in pen, so it must be true. Transcribed faithfully, with the chemistry of how it rises without eggs or butter."
feature_image: "/images/posts/gingersnap-cookies.webp"
thumbnail_image: "/images/posts/gingersnap-cookies.webp"
---

<script>
	import GingersnapScaler from '$lib/components/GingersnapScaler.svelte';
</script>

A recipe card. Stained, dog-eared, splotched with what is almost certainly molasses. Someone- not me- wrote **"good"** across it in looping pen, which is the highest honor a recipe card can receive and also the entire reason this one survived.

It's from the *Cookies & Snacks* section of an allergen cookbook- the kind organized around what each recipe leaves *out*: nut-free, shellfish-free, gluten-free, and so on. The corner is stamped with the book's free-from legend, `P, S, N`, flagging the major allergens this recipe is safe from. Everything here is milk-free and soy-free- the fat is a free-from margarine- and there are no eggs anywhere, so these are gingersnaps you can hand to nearly anyone at the table without a nervous speech first.

I photographed the card and ran it through Apple's Vision OCR (a tiny throwaway Swift program- more on that at the end) rather than hand-typing it, then reconciled the output against the photo line by line. Here it is, faithfully- with metric volume and weight beside each measure, since a "cup" means different things in different kitchens.

![A stained, dog-eared recipe card titled Gingersnap Cookies from the Cookies and Snacks section, with the word good handwritten across it in pen](/images/posts/gingersnap-cookies.webp)

## Gingersnap Cookies

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

Doubling for a crowd, or halving because five dozen is a lot? Tap a multiplier and the amounts update live- toggle US/metric too:

<GingersnapScaler />

## How it rises without eggs or butter

Two teaspoons of baking soda is a *lot* for a single batch- and that is the whole game. Baking soda is sodium bicarbonate, a base, and on its own it does almost nothing useful in the oven. It needs an acid. Give it one and you get a neutralization reaction- bicarbonate plus acid yields carbon dioxide, water, and a neutral salt. That CO₂, trapped in the dough, is the lift.

In most cookies the acid rides in on eggs, buttermilk, or sour cream. This recipe has none of those- no eggs, no dairy. So where does the acid come from? The **orange juice** (citric and ascorbic acid) and the **molasses** (mildly acidic in its own right). They are not flavor garnish- they are the functional partner the soda needs. Leave the soda unreacted and you taste it: soapy, metallic, faintly bitter. The juice and molasses spend it down to gas and a clean finish- and, as a bonus, the soda mellows the molasses' sharper edges along the way.

That is the quietly impressive part. Coaxing reliable rise out of fruit juice and molasses- in a bake that is simultaneously **egg-free and dairy-free**, with neither of the usual structural or acidic crutches- is a genuinely tidy bit of mid-century formulation. Harold McGee walks through the bicarbonate/acid neutralization (and why leftover soda tastes off) in *On Food and Cooking*; [Baking Sense](https://www.baking-sense.com/baking-school/baking-science/ingredients/baking-powder-baking-soda/) covers the same chemistry from the baker's side. The gram weights above come from [King Arthur's ingredient weight chart](https://www.kingarthurbaking.com/learn/ingredient-weight-chart).

## Digitizing the card- Apple Vision OCR

I didn't want to hand-type a stained card and quietly fat-finger the clove measurement. So I let the machine read it. No `tesseract`, no pip install, no cloud upload of grandma-adjacent recipe cards- just the OCR engine that already ships inside macOS. Apple's **Vision** framework (`VNRecognizeTextRequest`) is genuinely excellent at this, and you can drive it from a ~40-line Swift program.

The flow was three steps:

1. `sips` to turn the iPhone HEIC into a PNG Vision can chew on:
   ```sh
   sips -s format png IMG_4509.HEIC --out recipe.png
   ```
2. Run the little Swift program below over the PNG.
3. Reconcile its output against the photo by eye. Vision even nailed the easily-smudged `2¼ cups flour`- the kind of cramped fraction I'd have second-guessed myself.

<details>
<summary><strong>Apple Vision OCR in ~40 lines of Swift</strong> (<code>VNRecognizeTextRequest</code>, accurate mode)</summary>

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

The only non-obvious bit is the sort. Vision hands back text observations in no particular order, each with a normalized `boundingBox`; sorting by `midY` (descending- Vision's origin is bottom-left) and then `midX` rebuilds the human reading order. `customWords` nudges the language model toward cooking vocabulary so it doesn't "correct" *molasses* into something tidier.

</details>

It spat out the whole card in one pass- title, both ingredient columns, the method paragraph- in the right order, fractions and all.

### Footer: building it with the LLVM/Swift toolchain

No package manager involved. The OCR brains live in Apple's `Vision.framework`; the only "toolchain" is the Swift compiler that ships with the Xcode command-line tools- and that compiler *is* LLVM.

```sh
# What's under the hood — swiftc is an LLVM frontend, bundled with clang:
$ swift --version
Apple Swift version 6.3.2 (swiftlang-6.3.2.1.108 clang-2100.1.1.101)
Target: arm64-apple-macosx26.0
```

Two ways to run it. Quick-and-dirty, let the toolchain JIT it:

```sh
swift ocr.swift recipe.png
```

Or compile an optimized native binary and keep it around:

```sh
# -O turns on LLVM's optimizer; link the two system frameworks we touch.
swiftc -O ocr.swift -o ocr -framework Vision -framework AppKit
./ocr recipe.png
```

That `swiftc` invocation is the whole pipeline: Swift source → **SIL** (Swift's own IR) → **LLVM IR** → the LLVM backend emits `arm64` machine code for the `arm64-apple-macosx` target, linked against the system frameworks. The bundled `clang` shares the same LLVM. Roughly 87 KB of binary, no runtime dependencies beyond what's already on the Mac- and it reads a 70-year-feeling recipe card better than I can.
