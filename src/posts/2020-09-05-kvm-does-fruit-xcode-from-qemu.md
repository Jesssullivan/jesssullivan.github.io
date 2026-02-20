---
title: "KVM does Fruit: Xcode from QEMU"
date: "2020-09-05"
description: "The digression starts over here: https://github.com/kholia/OSX-KVM Hmmmm..... ? ...In the mean time, here is my ./OpenCore-Boot.sh: #!/usr/bin/env bash # setup..."
tags: ["Featured"]
published: true
slug: "kvm-does-fruit-xcode-from-qemu"
original_url: "https://transscendsurvival.org/2020/09/05/kvm-does-fruit-xcode-from-qemu/"
---

### The digression starts over here:

#### https://github.com/kholia/OSX-KVM

*Some images from the original WordPress post are no longer available.*

_Hmmmm....._

#### _?_

**_...In the mean time, here is my`./OpenCore-Boot.sh:`_**

    #!/usr/bin/env bash

    # setup tap0 if haven't already for $session:
    sudo ip tuntap add dev tap0 mode tap
    sudo ip link set tap0 up promisc on
    sudo ip link set dev virbr0 up
    sudo ip link set dev tap0 master virbr0

    REPO_PATH="./"
    OVMF_DIR="."

    args=(
      -enable-kvm -m 24000 -cpu Penryn,kvm=on,vendor=GenuineIntel,+invtsc,vmware-cpuid-freq=on,+pcid,+ssse3,+sse4.2,+popcnt,+avx,+aes,+xsave,+xsaveopt,check
      -machine q35
      -smp 4,cores=2,sockets=1
      -device usb-ehci,id=ehci
      -device usb-kbd,bus=ehci.0
      -device usb-mouse,bus=ehci.0
      -device nec-usb-xhci,id=xhci
      -device isa-applesmc,osk="ourhardworkbythesewordsguardedpleasedontsteal(c)AppleComputerInc"
      -drive if=pflash,format=raw,readonly,file="$REPO_PATH/$OVMF_DIR/OVMF_CODE.fd"
      -drive if=pflash,format=raw,file="$REPO_PATH/$OVMF_DIR/OVMF_VARS-1024x768.fd"
      -smbios type=2
      -device ich9-intel-hda -device hda-duplex
      -device ich9-ahci,id=sata
      -drive id=OpenCoreBoot,if=none,snapshot=on,format=qcow2,file="$REPO_PATH/OpenCore-Catalina/OpenCore-nopicker.qcow2"
      -device ide-hd,bus=sata.2,drive=OpenCoreBoot
      -device ide-hd,bus=sata.3,drive=InstallMedia
      -drive id=InstallMedia,if=none,file="$REPO_PATH/BaseSystem.img",format=raw
      -drive id=MacHDD,if=none,file="$REPO_PATH/mac_hdd_ng.img",format=qcow2
      -device ide-hd,bus=sata.4,drive=MacHDD
      -netdev tap,id=net0,ifname=tap0,script=no,downscript=no -device vmxnet3,netdev=net0,id=net0,mac=52:54:00:c9:18:27
      -vga vmware
    )

    qemu-system-x86_64 "$&#123;args[@]&#125;"
