---
title: "Trashmonitor, or a Lil Tailnet Window Into the Hardware Pile"
date: "2026-05-11"
description: "A tiny tailnet-only webcam monitor for keeping an eye on XR goggles, dev boards, and whatever hardware is blinking suspiciously while I am away from my desk."
tags: ["homelab", "hardware", "tailscale", "kubernetes", "streaming", "xr", "ffmpeg", "mediamtx", "sveltekit"]
category: "hardware"
published: false
slug: "trashmonitor-tailnet-window-into-the-hardware-pile"
source_repo: "Jesssullivan/tailnet-trashmonitor"
source_path: "README.md"
excerpt: "I built a very small tailnet-only streaming surface so I can glance at XR goggles, dev boards, and the hardware pile from elsewhere in the house without turning it into a whole product."
feature_image: "/images/posts/trashmonitor-setup.webp"
thumbnail_image: "/images/posts/trashmonitor-screenshot.webp"
---

So here's the thing-

I keep leaving my desk while hardware is doing hardware things, and sometimes I still want one quick glance at the bench.

XR goggles warming up. Dev boards blinking. The hardware pile doing its quiet little "am I fine or am I about to waste your afternoon" routine.

So I made [`tailnet-trashmonitor`](https://github.com/Jesssullivan/tailnet-trashmonitor): a tiny tailnet-only webcam monitor for the lab bench. Capture host pushes H.264-over-RTSP, MediaMTX turns it into HLS, Caddy serves the static SvelteKit page, and my browser gets a couple of live tiles.

Not a product. Not a camera platform. Just a lil window.

| The bench view | The stream view |
| --- | --- |
| ![Physical trashmonitor capture setup pointed at the hardware bench](/images/posts/trashmonitor-setup.webp) | ![Trashmonitor dashboard showing tailnet camera streams](/images/posts/trashmonitor-screenshot.webp) |

## The shape

The whole architecture is basically "push video into the cluster, watch HLS from the tailnet."

That is enough.

```mermaid
flowchart LR
    subgraph Capture["Capture hosts on the tailnet"]
        Camera["V4L2 webcam"] --> Unit["trashcam@id.service"]
        Unit --> FFmpeg["ffmpeg + libx264"]
        Env["/etc/trashcam/id.env"] -. config .-> Unit
        Ansible["ansible role or RPM"] -. provisions .-> Env
    end

    subgraph Tailnet["Tailscale auth boundary"]
        RtspLB["trashmonitor-rtsp LoadBalancer"]
        WebLB["trashmonitor LoadBalancer"]
    end

    subgraph Cluster["Kubernetes namespace: trashmonitor"]
        Caddy["Caddy"]
        MediaMTX["MediaMTX"]
        Api["MediaMTX API :9997"]
        Hls["MediaMTX HLS :8888"]
        Metrics["MediaMTX metrics :9998"]
        Spa["Static SvelteKit SPA"]
        Cert["cert-manager TLS secret"]
    end

    Browser["Tailnet browser with hls.js"] -->|"GET /, /api, /stream/index.m3u8"| WebLB
    WebLB -->|"80 or 443"| Caddy
    Caddy -->|"serves /srv/spa"| Spa
    Caddy -->|"strip /api"| Api
    Caddy -->|"proxy HLS playlists and segments"| Hls

    FFmpeg -->|"RTSP over TCP publish to :8554/id"| RtspLB
    RtspLB -->|"8554"| MediaMTX
    MediaMTX --> Api
    MediaMTX --> Hls
    MediaMTX --> Metrics

    Cloudflare["Cloudflare A record to tailnet IP"] -. alias .-> Browser
    SplitDNS["Tailscale split-DNS for your zone"] -. resolver path .-> Browser
    Cert -. mounted into .-> Caddy
```

The capture side is deliberately plain: `trashcam@<id>.service` loads `/etc/trashcam/<id>.env`, runs `/usr/bin/ffmpeg`, reads `/dev/video*`, transcodes MJPEG to H.264 with `libx264`, and publishes RTSP over TCP to the cluster. No wrapper daemon. No web server on the capture host. Just systemd and `ffmpeg`.

| Piece | Job |
| --- | --- |
| `capture/bin/trashcam-ffmpeg` | read V4L2, encode H.264, publish RTSP |
| `capture/systemd/trashcam@.service` | supervise each camera path |
| `server/mediamtx.yml` | accept RTSP publishes, emit HLS, expose API and metrics |
| `server/Caddyfile` | route SPA, API, and HLS over the tailnet viewer service |
| `spa/` | static SvelteKit tiles using `hls.js` |
| `server/k8s/service.yaml` | expose separate Tailscale LoadBalancers for viewers and RTSP ingest |

The separate RTSP hostname is the one bit of extra ceremony I like: `trashmonitor` is the viewer surface, `trashmonitor-rtsp` is the publisher surface.

Same workload. Different tailnet doors.

## Auth boundary

MediaMTX allows anonymous publish, read, API, metrics, and playback.

That sounds spicy until the important part: the services are exposed through the Tailscale Kubernetes operator, and the reachable surface is tailnet-only. Tailnet membership is the auth boundary. The public DNS alias, if I use one, is just an A record to the Tailscale CGNAT address so my own devices get a friendly name.

Publicly resolvable. Not publicly routable.

Good enough for a single-tenant bench camera.

## The useful part

The requirements stayed small:

- H.264/HLS for browser playback.
- RTSP-TCP from capture hosts so cluster restarts are survivable.
- Static SPA, because this does not need a Node runtime in the cluster.
- MediaMTX, because the previous go2rtc route hit a codec typing bug with the RTP payloads I was producing.
- Full `ffmpeg` on capture hosts, because HLS wants H.264 and distro `ffmpeg-free` builds are not always allowed to carry `libx264`.

This lets me walk away from the desk and still keep the goggles, boards, and blinking bench weirdness in view. If a board reboots, I can see it. If a display goes dark, I can see it. If everything is behaving, I can stop hovering.

That is enough.

Huzzah for tiny infrastructure.

-Jess
