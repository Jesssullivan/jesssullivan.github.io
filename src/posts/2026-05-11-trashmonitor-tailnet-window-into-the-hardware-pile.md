---
title: "Trashmonitor to oggle my goggles and behold the blinkenlights"
date: "2026-05-11"
description: "Afternoon yakshearing: a little tailnet-only webcam monitor made of ewaste for keeping an eye on XR goggles, dev boards, and whatever hardware is blinking suspiciously while I am away from my desk."
tags: ["homelab", "hardware", "tailscale", "kubernetes", "streaming", "xr", "ffmpeg", "mediamtx", "sveltekit"]
category: "hardware"
published: true
slug: "trashmonitor-tailnet-window-into-the-hardware-pile"
source_repo: "Jesssullivan/tailnet-trashmonitor"
source_path: "README.md"
excerpt: "I glued together a tittle tailnet-only streaming surface so I can oggle my goggles, blinkenlights, dev boards, and the hardware pile from the sanctum of anywhere"
feature_image: "/images/posts/trashmonitor-setup.webp"
thumbnail_image: "/images/posts/trashmonitor-screenshot.webp"
---


How to oggle my goggles and behold my blinkenlights while away from the basement?   Here is my Sunday's afternoon capture host project.  TrashMonitor pushes H.264-over-RTSP via MediaMTX, served through a local Caddy proxy into a simple SvelteKit SPA running from one of the basement clusters. 

Find the repo here: [`tailnet-trashmonitor`](https://github.com/Jesssullivan/tailnet-trashmonitor) 


| The bench view | The stream view |
| --- | --- |
| ![Physical trashmonitor capture setup pointed at the hardware bench](/images/posts/trashmonitor-setup.webp) | ![Trashmonitor dashboard showing tailnet camera streams](/images/posts/trashmonitor-screenshot.webp) |


The whole architecture is basically "push video into the cluster, watch HLS from the tailnet."


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


| Piece | Job |
| --- | --- |
| `capture/bin/trashcam-ffmpeg` | read V4L2, encode H.264, publish RTSP |
| `capture/systemd/trashcam@.service` | supervise each camera path |
| `server/mediamtx.yml` | accept RTSP publishes, emit HLS, expose API and metrics |
| `server/Caddyfile` | route SPA, API, and HLS over the tailnet viewer service |
| `spa/` | static SvelteKit tiles using `hls.js` |
| `server/k8s/service.yaml` | expose separate Tailscale LoadBalancers for viewers and RTSP ingest |


MediaMTX allows anonymous publish, read, API, metrics, and playback; the services are exposed through the Tailscale Kubernetes operator, and the reachable surface is tailnet-only. Tailnet membership is the auth boundary. The public DNS alias, if I use one, is just an A record to the Tailscale CGNAT address so my own devices get a friendly name.

This lets me walk away from the desk and still keep the goggles, boards, and ***blinkenlights*** bench weirdness in view. If a board reboots, I can see it. If a display goes dark, I can see it.   :eyes:
Huzzah!

-Jess
