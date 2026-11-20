# <img src="./src-tauri/icons/128x128.png" width="64"/> Splicerr

> [!IMPORTANT]
> **I am _not_ the developer or maintainer of Splicerr.** This is a temporary
> community fork of [Robert-K/splicerr](https://github.com/Robert-K/splicerr),
> published only to help users while the upstream app is broken.
>
> Splice's GraphQL API started requiring Apollo preflight headers, which stopped
> upstream from loading samples. This fork applies that fix (see upstream
> [issue #30](https://github.com/Robert-K/splicerr/issues/30)) so the app works again.
> **Once the fix is merged upstream, please go back to the [original repository](https://github.com/Robert-K/splicerr).**
>
> All credit goes to the original authors — [@Robert-K](https://github.com/Robert-K)
> and [@ascpixi](https://github.com/ascpixi). As a small bonus, this fork also adds a
> tempo-preserving **Transpose** feature (see [Features](#features)).

**Splicerr** is an alternative frontend for the popular [Splice](https://splice.com/features/sounds) sample library. It does not require any authentication and contains all of the most important features of the regular desktop app (including drag-and-drop).

It's basically a full rewrite of [ascpixi's](https://github.com/ascpixi) [Splicedd ❤️](https://github.com/ascpixi/splicedd), just with a couple more features and built with [Svelte](https://svelte.dev/) and [Tauri 2.0](https://v2.tauri.app/).

Please show your appreciation by starring ⭐ the [original project](https://github.com/ascpixi/splicedd), as it made this all possible.

<p align="center">
  <br>
  <a href="https://github.com/robert-k/splicerr/releases/"><b>Upstream releases</b></a>
</p>

## This fork

- **Audition samples** by clicking a row. Click it again to restart. The waveform still seeks, and the pack thumbnail fills as its audio downloads.
- **Browse packs** from the Packs view or choose **Show pack samples** from a thumbnail. Save a whole pack to Likes or a collection, or download its available previews as WAVs to the configured **Samples Directory** or a folder you choose.
- **Align BPM** applies one target tempo to previews and dragged WAVs when source BPM is available. It works without a DAW Bridge. Turn on **Pre-render aligned WAVs** in the same menu to prepare the selected and buffered samples in the background. Transpose by key or semitones is in that menu too.
- **Preload previews** under Settings sets how many previews to buffer from the first visible row. The default is 12. Set it to 0 to turn it off.
- Use **Reshuffle** to change the result order, **Always on top** to keep Splicerr above the DAW, and **Compact view** to narrow the window.

Live tempo previews use the WebView's pitch-preserving playback. WAV export uses [SoundTouch](https://soundtouch.surina.net/README.html) in a background worker. Tempo alignment preserves pitch. The separate Transpose control changes it when enabled.

## Demo

https://github.com/user-attachments/assets/34f1ba90-c881-4a04-a5df-c147bdb51c2c

## Features

- Drag-and-drop samples
- **Collections & Likes — organize and tag-filter your sounds locally** ✨ _new in this fork_
- **Transpose by key or pitch (tempo-preserving)** ✨ _new in this fork_
- Search suggestions
- Tag filtering
- Infinite scrolling
- Waveform previews
- Sort by popularity, bpm & more
- Dark & light mode
- Custom UI scale
- Adjustable preview volume

## 🔧 How to develop

1. Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) & [pnpm](https://pnpm.io/installation)
2. Clone this fork: `git clone https://github.com/Er0p11/splicerr`
3. Install dependencies: `pnpm i`
4. Start the development server: `pnpm tauri dev`

## 💡 Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

[![forthebadge](https://forthebadge.com/images/badges/contains-17-coffee-cups.svg)](https://forthebadge.com) [![forthebadge](https://forthebadge.com/images/badges/made-with-out-pants.svg)](https://forthebadge.com) [![forthebadge](https://forthebadge.com/images/badges/works-on-my-machine.svg)](https://forthebadge.com)
