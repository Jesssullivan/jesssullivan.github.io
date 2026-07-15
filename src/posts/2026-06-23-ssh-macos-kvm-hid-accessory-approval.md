---
title: "The tiny SSH trick for letting a USB KVM talk to a locked Mac"
date: "2026-06-23"
description: "A quick macOS tip for allowing a NanoKVM-style USB HID accessory from an SSH session when Screen Sharing is unavailable and the Mac is stuck at the login window."
tags: ["macOS", "hardware", "homelab", "usb-protocol", "kvm", "ssh"]
published: true
slug: "ssh-macos-kvm-hid-accessory-approval"
category: "hardware"
author_slug: "jesssullivan"
---

Quick reference for letting a USB KVM HID device enumerate on a Mac that is sitting at the login window, when Screen Sharing is not usable and SSH is.

On Apple silicon Mac laptops, macOS blocks data for new USB, Thunderbolt, and similar accessories until a console user approves them. From SSH, the local escape hatch is the `com.apple.applicationaccess` restriction preference. The key name is inverted from the thing you want: `allowUSBRestrictedMode` set to `false` is what disables the restriction and lets the accessory talk without a console click:

```bash
TARGET="user@mac-on-your-network"

read -rsp "sudo password for remote Mac: " SUDO_PASS
echo

printf '%s\n' "$SUDO_PASS" | ssh -tt "$TARGET" \
  "sudo -S -p '' /bin/sh -c '
    /usr/bin/defaults write /Library/Preferences/com.apple.applicationaccess allowUSBRestrictedMode -bool false
    /usr/bin/killall cfprefsd 2>/dev/null || true
  '"

unset SUDO_PASS
```

Recheck the USB tree:

```bash
ssh "$TARGET" \
  "/usr/sbin/ioreg -p IOUSB -w0 -l | /usr/bin/grep -E 'USB Product Name|USB Vendor Name|idVendor|idProduct|\\+-o '"
```

And the HID side:

```bash
ssh "$TARGET" \
  "/usr/sbin/ioreg -r -c IOHIDDevice -l -w0 | /usr/bin/grep -E '^\\+-o |\"Product\"|\"Manufacturer\"|\"Transport\"|\"VendorID\"|\"ProductID\"|\"Built-In\"'"
```

The KVM should now enumerate as both a USB device and a USB HID device.

Notes:

- Do not put the sudo password in the SSH command line; process listings and shell history are boring places to leak secrets.
- Apple documents the durable control as a device-level `com.apple.applicationaccess` restrictions profile, normally delivered by MDM. The local preference is a one-off escape hatch, not fleet enforcement.
- On a Mac whose USB is load-bearing — external SSD scratch for nix and bazel, YubiKeys, darwin artifact builds that have to keep enumerating with nobody at the console — you want this off durably through that device-level profile rather than poked in ad hoc. Same knob, opposite lifetime.

When done, either wipe the Mac as planned or undo the local override; deleting the key restores the default, so approval prompts come back:

```bash
read -rsp "sudo password for remote Mac: " SUDO_PASS
echo

printf '%s\n' "$SUDO_PASS" | ssh -tt "$TARGET" \
  "sudo -S -p '' /usr/bin/defaults delete /Library/Preferences/com.apple.applicationaccess allowUSBRestrictedMode"

unset SUDO_PASS
```
