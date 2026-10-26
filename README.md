# MTR Schedule Manager

A desktop application for visualizing and managing train schedules on [Minecraft Transit Railway](https://www.minecrafttransitrailway.com/) servers.

![Build](https://github.com/kk-prod-dev/MTR-Schedule-manager/actions/workflows/build.yml/badge.svg)
![Version](https://img.shields.io/github/v/release/kk-prod-dev/MTR-Schedule-manager)

---

## Features

- **Live timetable dashboard** — see all trains at any station in real time, with platform conflict detection
- **Train graph** — space-time diagram showing all trips across stations
- **Route cards** — metadata, train consist diagram, per-stop timetable with live deviations, schedule formula
- **Editor** — free-form canvas for designing printable station timetables (Aushangfahrplan): insert a live timetable with filters and column selection, format text and shapes, presets, share codes, PNG export
- **Desktop notifications** — alerts for new platform conflicts across the whole network and route delays, with thresholds and a favorites-only mode
- **Conflict detection** — highlights platform overlaps and minimum-interval violations
- **Draft routes** — plan new lines before adding them to the server
- **Multi-server support** — manage and switch between multiple MTR servers
- **7 languages** — English, Russian, German, French, Polish, Portuguese, Czech
- **Auto-updates** — notified of new releases with in-app changelog

---

## Requirements

- MTR server with the **web map** enabled (same URL you open in a browser)
- Windows 10+, macOS 11+, or Linux (AppImage)

---

## Installation

Download the latest installer from [Releases](https://github.com/kk-prod-dev/MTR-Schedule-manager/releases).

| Platform | File |
|----------|------|
| Windows  | `MTRScheduleManager-Setup-x.x.x.exe` |
| macOS (Apple Silicon) | `MTRScheduleManager-x.x.x-arm64.dmg` |
| macOS (Intel) | `MTRScheduleManager-x.x.x-x64.dmg` |
| Linux    | `MTRScheduleManager-x.x.x.AppImage` |

macOS builds are unsigned — on first launch, right-click the app and choose **Open**.

---

## Connecting your world

1. Open **Settings** in the app
2. In the **MTR Servers** section, type your server's web map URL (e.g. `http://localhost:8888`)
3. Press **+** to add it
4. Select it from the dropdown — stations and routes load automatically

`http://localhost:8888` is always available as the default for local worlds.

---

## Development

```bash
git clone https://github.com/kk-prod-dev/MTR-Schedule-manager.git
cd MTR-Schedule-manager
npm install
npm run electron   # run in dev mode
```

### Build installers

```bash
npm run dist:win    # Windows (.exe)
npm run dist:mac    # macOS (.dmg) — requires macOS
npm run dist:linux  # Linux (.AppImage) — requires Linux
```

CI builds all three platforms on every push to `main` (artifacts in the
Actions run); pushing a `v*` tag also attaches them to the GitHub Release.

### Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron |
| Local server | Node.js + Express |
| Frontend | Vanilla JS / HTML / CSS |
| Storage | File-based JSON |

### Project structure

```
├── electron/        # Main process & preload script
├── public/          # Frontend (app.js, index.html, style.css, i18n-extra.js)
├── src/             # Backend (schedule.js, store.js, poller.js)
├── build/           # App icons
├── server.js        # Express API server
├── config.js        # Default configuration (BASE_URL, ports, paths)
└── package.json
```

### Key files

- `public/app.js` — all frontend logic, rendering, i18n, state
- `public/boardEditor.js` — the Editor tab (fabric.js canvas for printable timetables)
- `public/i18n-extra.js` — translations for DE / FR / PL / PT / CS
- `src/schedule.js` — timetable calculation, conflict detection, train graph data
- `src/store.js` — in-memory store with disk persistence
- `src/poller.js` — background polling from MTR API
- `server.js` — Express routes, prefs, drafts, changelog API

---

## Support

Join the Discord: **https://discord.gg/qEuc7xCfwe**

---

## License

MIT
