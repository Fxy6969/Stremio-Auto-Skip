# Stremio Auto-Skip

https://github.com/user-attachments/assets/c2503603-9fff-4d1d-b7f0-e5c348873580

[![GitHub stars](https://img.shields.io/github/stars/Fxy6969/Stremio-Glass-Theme?style=social)](https://github.com/Fxy6969/Stremio-Glass-Theme/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/Fxy6969/Stremio-Glass-Theme?style=flat&logo=github)](https://github.com/Fxy6969/Stremio-Glass-Theme/releases)
[![Discord](https://img.shields.io/discord/1470879221164282064?style=flat&logo=discord&logoColor=white&label=Discord&color=5865F2)](https://discord.gg/qxDpXdq6)
[![Reddit Community](https://img.shields.io/reddit/subreddit-subscribers/StremioMods?style=social&logo=reddit&label=r/StremioMods)](https://www.reddit.com/r/StremioMods/)  

**Stremio Auto-Skip** is a lightweight Stremio Enhanced plugin that automatically detects TV show intros and shows a **"Skip Intro"** button — just like Netflix.  

---

## ✨ Features

- ⏭️ **Skip button** — appears on screen exactly when an intro or recap starts, disappears when it ends
- ⚡ **Instant results** — skip data is fetched from a community database, no analysis needed
- 🪶 **Zero dependencies** — single file, no server, no setup

---

## 📷 Screenshots

### Skip Button
![Skip Button](https://github.com/user-attachments/assets/0b4c068c-d9f3-4bb3-8fab-cb074bf701b4)

Button appears when intro starts

---

## 📥 Installation

### 1. Via Stremio Enhanced Marketplace (Recommended)
1. Open **Stremio Enhanced** → Settings → Marketplace
2. Search for **Stremio Auto-Skip**
3. Click Install
4. Restart Stremio

### 2. Manual Installation
1. Download `auto-skip.plugin.js` from the [Releases page](https://github.com/Fxy6969/stremio-auto-skip/releases)
2. Open your Stremio Enhanced plugins folder
3. Drag and drop the file in
4. Restart Stremio

---

## 🖥️ Requirements

- **Stremio Enhanced** (mandatory — the standard Stremio app does not support plugins)

---

## 🔧 How It Works

1. The plugin reads the IMDb ID, season, and episode number from the current URL
2. It queries a community skip database for that episode
3. When playback enters the segment, the **Skip** button appears
4. Clicking it jumps directly to the end of the intro

Results are cached locally so the API is only hit once per episode.

---

## ⚙️ Configuration

At the top of the plugin file you can change the API endpoint if needed:

```js
this.EXTERNAL_API = 'https://mzt4pr8wlkxnv0qsha5g.website/intro';
```

> ⚠️ This plugin relies on a third-party community API that is not affiliated with this project. If the API goes down, skip data will be unavailable until an alternative is configured.

---

## 🧪 Known Issues and TODO

- Skip data is only available for episodes that have been submitted to the community database — not all episodes will have results
- Recap detection is currently not implemented.
- Highlight skippable segment on the progressbar
- Caching

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a PR

**Good areas to contribute:**
- Support for additional skip types (credits, recaps)
- Fallback API sources
- Bug fixes and reliability improvements

---

## ⚠️ Disclaimer

- Not affiliated with or endorsed by Stremio
- Relies on a third-party API for skip data — availability is not guaranteed
- Use at your own discretion

---

## 📝 Changelog

### v26.0.0
- Removed server dependency — plugin now runs entirely in the browser
- Added localStorage caching with 7-day TTL
- Added yellow progress bar highlight for skippable segments
- Streamlined to a single self-contained file
  
---

**Made with ❤️ for the Stremio community**
