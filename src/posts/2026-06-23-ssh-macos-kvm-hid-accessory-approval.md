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

Tiny discovery.

I was decommissioning a Mac and needed a USB KVM HID device to enumerate before I wiped the machine. The fun part was that the Mac was sitting at the login window, Screen Sharing was not getting me into a usable session, and SSH worked perfectly.

So naturally the accessory prompt was somewhere I could not click.

On Apple silicon Mac laptops, macOS can block data for new USB, Thunderbolt, and similar accessories until a console user approves them. That is the right default! It is also a lil awkward when the whole point of the KVM is "please let me reach the console from over here."

The SSH-side workaround that got me moving was flipping the local accessory restriction preference off. The key name is inverted from the thing you want: `allowUSBRestrictedMode` set to `false` is what disables the restriction and lets the accessory talk without a console click:

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

Then I rechecked the USB tree:

```bash
ssh "$TARGET" \
  "/usr/sbin/ioreg -p IOUSB -w0 -l | /usr/bin/grep -E 'USB Product Name|USB Vendor Name|idVendor|idProduct|\\+-o '"
```

And the HID side:

```bash
ssh "$TARGET" \
  "/usr/sbin/ioreg -r -c IOHIDDevice -l -w0 | /usr/bin/grep -E '^\\+-o |\"Product\"|\"Manufacturer\"|\"Transport\"|\"VendorID\"|\"ProductID\"|\"Built-In\"'"
```

After that, the NanoKVM showed up as both a USB device and USB HID device.

Huzzah.

Two caveats. First, do not put the sudo password in the SSH command line; process listings and shell history are boring places to leak secrets. Second, if this is a managed Mac, the cleaner durable fix is an MDM/Jamf restrictions payload for `allowUSBRestrictedMode`, scoped only as long as you need it. For a one-off decommissioning session, the local preference was enough.

The flip side: on a Mac whose USB is load-bearing — external SSD scratch for nix and bazel, YubiKeys, darwin artifact builds that have to keep enumerating even when nobody is at the console — you probably want this off *durably*, declared in your MDM payload or nix-managed defaults rather than poked in ad hoc. Same knob, opposite lifetime.

When done, either wipe the Mac as planned or undo the local override (deleting the key restores the default, so approval prompts come back):

```bash
read -rsp "sudo password for remote Mac: " SUDO_PASS
echo

printf '%s\n' "$SUDO_PASS" | ssh -tt "$TARGET" \
  "sudo -S -p '' /usr/bin/defaults delete /Library/Preferences/com.apple.applicationaccess allowUSBRestrictedMode"

unset SUDO_PASS
```

Tiny gate. Useful escape hatch.

-Jess
