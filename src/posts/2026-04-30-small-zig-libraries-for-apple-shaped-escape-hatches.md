---
title: "Little Zig Libraries for Fruit-Shaped Escape Hatches"
date: "2026-04-30"
description: "A small map of my Zig C ABI libraries for crypto, notifications, keychain storage, and CTAP2, and why I am using them as portable native capability layers for macOS-first FOSS apps that should also build cleanly on Linux."
tags: ["zig", "foss", "ffi", "swift", "objc", "linux", "macos", "ctap2", "keychain", "notifications", "crypto"]
category: "software"
published: false
slug: "small-zig-libraries-for-apple-shaped-escape-hatches"
excerpt: "Four tiny Zig libraries, one small thesis: keep the app shell pleasant on macOS, but move native capabilities behind a boring C ABI so Linux ports do not become full rewrites."
feature_image: "/images/posts/zig-ffi-apple-linux-bridge.png"
---

![Zig C ABI bridge from Apple application code to Linux native capabilities](/images/posts/zig-ffi-apple-linux-bridge.svg)

I've bumped into this quandry a few times, most recently in an ongoing side quest to fully port cmux emulator and multiplexer to a wide array of popular Linux distrobutions- [I'd *love* help QAing these for a proper release, much to do](https://github.com/Jesssullivan/cmux/issues?q=is%3Aissue%20state%3Aclosed).  


The pattern is pretty boring, it is more exciting in my head I guess: build a small native library in Zig, expose a stable C ABI, keep the SwiftUI/AppKit/UIKit/Cocoa bits as the application shell on macOS, and make the native capability boundary portable enough that a Linux build can call the same conceptual surface without pretending to be an Apple app.

```mermaid
graph LR
    App["macOS app shell<br/>SwiftUI / AppKit / ObjC"] --> ABI["small C ABI<br/>owned by Zig"]
    ABI --> Crypto["zig-crypto<br/>std.crypto primitives"]
    ABI --> Notify["zig-notify<br/>osascript / libnotify"]
    ABI --> Keychain["zig-keychain<br/>SecItem / Secret Service"]
    ABI --> CTAP["zig-ctap2<br/>IOKit HID / hidraw"]
    Crypto --> Linux["Linux-native builds"]
    Notify --> Linux
    Keychain --> Linux
    CTAP --> Linux

    style ABI fill:#f7a41d,stroke:#9f6500,color:#111
    style Linux fill:#4a9,stroke:#2a7,color:white
```

I have been calling this "de-attestation" work as these 4 libraries represent structures require signed apple attestations to build, package and distribute; by snipping these stuctures out, I can retain the SwitftUI core toolchain and compilation structures for application itself, disabiguating only for target specific operations, such as CTAP2, DE notifications, Crypto etc. This does not mean weakening platform policy, the structures are still signable and attestable using normal GPG signatories. ^w^


| Library | What it owns | Apple-ish analog | Linux / portable path |
| --- | --- | --- | --- |
| [`zig-crypto`](https://github.com/Jesssullivan/zig-crypto) | Hashing, HMAC, AES-CBC, PBKDF2, P-256 ECDH, Ed25519, CSPRNG | CryptoKit, CommonCrypto, `SecRandomCopyBytes` | Zig `std.crypto`, no system crypto dependency |
| [`zig-notify`](https://github.com/Jesssullivan/zig-notify) | Local desktop notifications | `UNUserNotificationCenter`, AppleScript notification calls | libnotify over D-Bus |
| [`zig-keychain`](https://github.com/Jesssullivan/zig-keychain) | Generic secret storage | Keychain Services `SecItemAdd`, `SecItemCopyMatching`, `SecItemDelete` | Secret Service / libsecret |
| [`zig-ctap2`](https://github.com/Jesssullivan/zig-ctap2) | External authenticator CTAP2 over USB HID | AuthenticationServices-adjacent passkey/authenticator flows, IOKit HID access | hidraw and a direct CTAP2 stack |

Docs are live here:

- [`zig-crypto`](https://transscendsurvival.org/zig-crypto/)
- [`zig-notify`](https://transscendsurvival.org/zig-notify/)
- [`zig-keychain`](https://transscendsurvival.org/zig-keychain/)
- [`zig-ctap2`](https://transscendsurvival.org/zig-ctap2/)

Zig not any more suited to this than Rust, C3, Odin or Hare perse, this is just the screwdriver I've adopted for tiny, native boundary code that can be audited, cross-compiled, documented, and called from nearly anything that understands C, which is most things.

```mermaid
sequenceDiagram
    participant UI as App UI
    participant ABI as Zig C ABI
    participant Mac as macOS backend
    participant Linux as Linux backend

    UI->>ABI: store token / notify user / enumerate security key
    alt macOS build
        ABI->>Mac: Security.framework, osascript, IOKit, std.crypto
        Mac-->>ABI: narrow result
    else Linux build
        ABI->>Linux: libsecret, libnotify, hidraw, std.crypto
        Linux-->>ABI: narrow result
    end
    ABI-->>UI: stable app-facing response
```

#### These are not library / SwitUI ecosystem complete; stuff I have to aide in continued expansion:
- SwiftPM/modulemap smoke tests so Swift can import the headers cleanly.
- Objective-C sample code that shows the bridge without hand-waving.
- Header nullability annotations so Swift sees nicer optional boundaries.
- Migration examples from CryptoKit/CommonCrypto, UserNotifications, SecItem, and WebAuthn-ish request things.
- Packaging examples for distro-ish Linux environments.

Huzzah,
-Jess
