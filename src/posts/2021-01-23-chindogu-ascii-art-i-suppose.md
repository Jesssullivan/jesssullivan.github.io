---
title: "Chindōgu ASCII art"
date: "2021-01-23"
description: "A ridiculous Chindōgu utility prompt & CLI for fetching private releases & files from GitHub & BitBucket curl –output LeafletSync && chmod +x LeafletSync &&..."
tags: ["Featured"]
published: true
slug: "chindogu-ascii-art-i-suppose"
original_url: "https://www.transscendsurvival.org/2021/01/23/chindogu-ascii-art-i-suppose/"
---

_A ridiculous_ [_Chindōgu_](https://en.wikipedia.org/wiki/Chind%C5%8Dgu) _utility prompt & CLI for_ [_fetching private releases & files from GitHub & BitBucket_](https://github.com/Jesssullivan/LeafletSync)

    curl https://raw.githubusercontent.com/Jesssullivan/LeafletSync/main/LeafletSync --output LeafletSync && chmod +x LeafletSync && ./LeafletSync

  * Fetch, unpack, extract specific releases & files or a complete master branch from a private GitHub repo with an api access token
  * Fetch and extract specific files or complete branches from a private BitBucket account with user's git authentication
  * Prefill default prompt values with a variety of console flags
  * Save & load default prompt values with a file of environment variables, see templates [`FetchReleasegSampleEnv_GitHub`](https://github.com/Jesssullivan/LeafletSync/blob/main/FetchReleaseSampleEnv_GitHub), [`FetchFilegSampleEnv_BitBucket`](https://github.com/Jesssullivan/LeafletSync/blob/main/FetchFileSampleEnv_BitBucket), [`FetchEverythingSampleEnv_BitBucket`](https://github.com/Jesssullivan/LeafletSync/blob/main/FetchEverythingSampleEnv_BitBucket), [`FetchEverythingSampleEnv_GitHub`](https://github.com/Jesssullivan/LeafletSync/blob/main/FetchEverythingSampleEnv_GitHub); pass as an argument with the ` -e ` flag, (`./LeafletSync -e YourEnvFile`) or provide one on launch.

    ./LeafletSync

    LeafletSync: Do you want to load values from a file?

    If so, enter one now...:[Nope!]:

     _                 __ _      _     _____
    | |               / _| |    | |   /  ___|
    | |     ___  __ _| |_| | ___| |_  \ `--. _   _ _ __   ___
    | |    / _ \/ _` |  _| |/ _ \ __|  `--. \ | | | '_ \ / __|
    | |___|  __/ (_| | | | |  __/ |_  /\__/ / |_| | | | | (__
    \_____/\___|\__,_|_| |_|\___|\__| \____/ \__, |_| |_|\___|
     \                      _____________________/ |
      \ Fetch from Github: /        α wιρ Σ ♥ |_@__Jess
      /───────────────────/
      \ Your API Token    | -t |  --token | Required | = &lt;personal-api-token>
       | Your Handle      | -u |  --user  | Required | = &lt;You>
       | Source Repo      | -r |  --repo  \ Required  \ = &lt;RepoName>
       | Repository Owner | -a |  --author \ Required  \ = &lt;TheOwner>
       | Release Version  | -v |  --version | Optional | = Fetch Everything
      / Output Directory  | -o |  --out    / Optional  / = ./dist/
     /─────────────────────────/
     \ Fetch from BitBucket:  /
      \──────────────────────/
       \  Your Handle       / -bu  /  --b-user  / ~Required | = &lt;You>
        \ Your Passhrase   / -bp  / --b-pass   / ~Required / = &lt;token>
         \ Source Branch  / -bb  / --b-branch / ~Optional / = master
          \ Source File  / -bf  / --b-file   / ~Optional / = &lt;Fetch Everything>
           \────────────/

    Your Handle [&lt;You>]:

    Source Repo [&lt;RepoName>]:

    Repo Owner [&lt;TheOwner>]:

    Host: GitHub | BitBucket [GitHub]:

    Your Token [&lt;personal-api-token>]:

    Release to fetch: [&lt;v0.0.1>]:

    Output to fetch (e.g. /dist/*): [&lt;dist/>]:

    ...
