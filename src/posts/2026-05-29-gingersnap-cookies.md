---
title: "Gingersnap Cookies (from a milk-free, soy-free recipe card)"
date: "2026-05-29"
description: "An old milk-free, soy-free Gingersnap Cookies recipe card, OCR'd off a stained little index card with Apple Vision and transcribed faithfully- molasses, ginger, cinnamon, cloves, and a roll in sugar."
tags: ["recipe", "baking", "cookies", "gingersnap", "allergen-friendly", "ocr", "apple-vision", "swift", "llvm", "macos"]
category: "tutorial"
published: true
slug: "gingersnap-cookies"
excerpt: "A stained lil recipe card for milk-free, soy-free gingersnaps- someone scrawled 'good' across it in pen, so it must be true. Transcribed faithfully off the photo."
feature_image: "/images/posts/gingersnap-cookies.webp"
thumbnail_image: "/images/posts/gingersnap-cookies.webp"
---


A recipe card. Stained, dog-eared, splotched with what I am choosing to believe is molasses. Someone- not me- wrote **"good"** across it in looping pen, which is the highest honor a recipe card can receive and also the entire reason this one survived.

It's from the *Cookies & Snacks* section of some allergy-conscious cookbook (the corner is rubber-stamped `P, S, N`, which I read as the little allergen flags these books love). Everything in it is milk-free and soy-free- the fat is a free-from margarine- so these are gingersnaps you can hand to basically anyone at the table without a nervous speech first.

I photographed the card and ran it through Apple's Vision OCR (a tiny throwaway Swift program- `VNRecognizeTextRequest`, accurate mode, language correction on) rather than hand-typing it, then reconciled the output against the photo line by line. The one place the machine and I disagreed was the flour- it insisted "2 1/4," the card clearly says **2 1/2**, and the card wins. Here it is, faithfully.

![A stained, dog-eared recipe card titled Gingersnap Cookies from the Cookies and Snacks section, with the word good handwritten across it in pen](/images/posts/gingersnap-cookies.webp)

## Gingersnap Cookies

**Ingredients**

- ¾ cup milk-free, soy-free margarine
- 1 cup brown sugar
- ¼ cup molasses
- 2 Tbsp. orange juice
- 2½ cups flour
- 2 tsp. baking soda
- ½ tsp. salt
- 1 tsp. ground ginger
- 1 tsp. ground cinnamon
- 1 tsp. ground cloves
- granulated sugar (for rolling)

**Method**

1. Preheat oven to 375°F. Grease cookie sheets.
2. Cream the margarine, brown sugar, molasses, and orange juice.
3. In a separate bowl, sift together the flour, baking soda, salt, ginger, cinnamon, and cloves.
4. Stir the dry ingredients into the molasses mixture.
5. Form into small balls. Roll in granulated sugar, then place 2 inches apart on the greased cookie sheets.
6. Bake for 12 minutes.

Makes about 5 dozen cookies.

---

That's the whole card. The orange juice is the sneaky bit- a tablespoon-and-change of brightness hiding under all that molasses and clove. Five dozen is a lot of cookies. That's sort of the point.

## Digitizing the card- Apple Vision OCR

I didn't want to hand-type a stained card and quietly fat-finger the clove measurement. So I let the machine read it. No `tesseract`, no pip install, no cloud upload of grandma-adjacent recipe cards- just the OCR engine that already ships inside macOS. Apple's **Vision** framework (`VNRecognizeTextRequest`) is genuinely excellent at this, and you can drive it from a ~40-line Swift program.

The flow was three steps:

1. `sips` to turn the iPhone HEIC into a PNG Vision can chew on:
   ```sh
   sips -s format png IMG_4509.HEIC --out recipe.png
   ```
2. Run the little Swift program below over the PNG.
3. Reconcile its output against the photo by eye- which is exactly where it earned its keep: Vision read the flour as "2 1/4," the card says **2 1/2**, and a human gets the tiebreak.

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

It spat out the whole card in one pass- title, both ingredient columns, the method paragraph- in the right order. The full transcription above is that output, with my one-digit correction.

---

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
