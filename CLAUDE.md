# CLAUDE.md — MTR Schedule Manager

## Project overview

Desktop Electron app for visualizing and managing train schedules on Minecraft Transit Railway (MTR) servers. Connects to the MTR web map API, polls live departure data, and renders timetables, dashboards, and train graphs.

**Repo:** `kk-prod-dev/MTR-Schedule-manager`  
**Working dir:** `D:\KLIM\Documents\GitHub\MTR-Schedule-manager`  
**Stack:** Electron + Node.js/Express + Vanilla JS/HTML/CSS  
**Target MTR server:** any MTR server with web map enabled (default `http://localhost:8888`)

---

## Architecture

```
Electron (main.js)
  └── spawns Express server (server.js)
      ├── polls MTR API via src/poller.js
      ├── caches topology + departures in src/store.js
      ├── serves REST API to frontend
      └── loads frontend from public/

Frontend (public/app.js)
  ├── fetches /api/stations, /api/routes, /api/schedule/:id
  ├── renders dashboard, train graph, route cards
  ├── i18n via I18N object (RU+EN in app.js, DE/FR/PL/PT/CS in i18n-extra.js)
  └── persists prefs via /api/prefs
```

## Key files

| File | Purpose |
|------|---------|
| `server.js` | Express server, all API routes |
| `config.js` | BASE_URL, PORT, DATA_DIR — change BASE_URL for different MTR servers |
| `src/schedule.js` | Core: buildStationSchedule, buildRouteGraph, conflict detection |
| `src/store.js` | In-memory store, disk persistence (topology.json, departures-cache.json) |
| `src/poller.js` | Background polling from MTR API |
| `public/app.js` | All frontend logic (~4000 lines) |
| `public/i18n-extra.js` | Translations for DE/FR/PL/PT/CS (merged into I18N at runtime) |
| `public/index.html` | Single-page app shell |
| `electron/main.js` | Electron main process, auto-updater |
| `electron/preload.js` | contextBridge (savePrefsSync, onChangelog) |
| `pending-changelog.json` | Shown once after update, then deleted by server |

---

## Development commands

```bash
npm run electron      # dev mode (hot-reload not supported, restart manually)
npm run dist:win      # build Windows installer
npm run dist:mac      # build macOS DMG
npm run dist:linux    # build Linux AppImage
npm run build         # alias for dist:win
```

---

## Critical patterns & gotchas

### Time handling
- All internal calculations use **UTC milliseconds from midnight**
- `effArrival` / `tripOriginMs` are UTC ms — position blocks at `(ms / MS_PER_DAY) * TIMELINE_WIDTH`
- Axis ticks: position at UTC ms, label via `formatLocal(m * 60000)` — shows local time at correct UTC position
- `formatLocal(ms)` adds `currentTzOffsetMin() * 60000` for display only
- `formatUtc(ms)` — pure UTC display, used in timetable cells
- **Never** shift block positions by tzOffset — only shift labels

### MTR API quirks
- `vehicleId` has a typo: `cab_foward` (not `cab_forward`) — match both
- `tripOriginMs` for real routes = time at **last stop** (MTR counts backwards)
- For drafts: `departureTimesOfDayMs` = UTC ms from midnight (absolute, not relative)
- Draft entries flagged with `isDraftEntry: true` — skip `t0ToUtcMs()` conversion

### Draft routes
- `isDraftEntry: true` in departure entry → use `t0raw` directly as UTC ms
- `draftShift = t0Offset` added so timetable calculates forward from first stop
- Stored in `data/drafts/` as JSON files
- Filtered from route list if no stops match current server's stations

### i18n
- `I18N.en` and `I18N.ru` defined in `app.js`
- `i18n-extra.js` adds DE/FR/PL/PT/CS via `Object.assign(I18N, extra)` at load time
- **French apostrophes** in JS string literals break the file silently — always use `"` for i18n values
- `applyI18n()` called at end of `i18n-extra.js` to re-render after load
- `t(key, vars)` replaces `{var}` in strings — always pass vars object if key contains `{...}`

### Event listeners
- `initSettingsUI()` called multiple times (init, refreshAllViews, language switch)
- Guard all button listeners with `if (btn && !btn._hasListener) { btn._hasListener = true; ... }`
- Modal buttons (`editDraftInModalBtn` etc.) are recreated on each render — guard prevents duplicate listeners

### State management
- `state.stations`, `state.routes` — cleared on server switch
- `state.lastScheduleData` — current station dashboard data
- `state.currentDashboardEntries` — entries for visible blocks
- `_carsCache` keyed by `routeNumber` (string) to avoid float64 `routeId` precision loss
- `settings` object persisted via `/api/prefs` POST and `beforeunload` → `buildPrefsPayload()`

### Conflict detection
- Physical overlap always flagged
- Minimum interval configurable via slider (`state.minIntervalMin`)
- Turnaround pairs of same route: skip (check `reverseRouteId`/`pairedForwardRouteId`)
- Problem areas tab: lazy accumulation via `state._conflictedStations` / `state._conflictedRoutes`

### Reverse route detection (scoring)
- +100: first station of candidate = last of mine AND last = first
- +30: at least one endpoint matches
- +2×N: common intermediate stations
- +20: depot match
- -10: color mismatch (penalty only, not blocking)
- Threshold: score ≥ 30 to activate button

### renderServerList / getServerList
- Must be **global scope** (not inside `initSettingsUI`) — called from `refreshAllViews`
- `DEFAULT_SERVER = "http://localhost:8888"` always in list, cannot be removed
- `serverList` must be in both `savePrefsToServer()` payload AND `buildPrefsPayload()` (beforeunload)

### buildPrefsPayload
- Called on `beforeunload` for sync save
- Must include: `favorites`, `favoriteRoutes`, `langMode`, `tzMode`, `serverTzOffsetMin`, `minIntervalMin`, `overridesV2`, `routeOverrides`, `platformOverrides`, `serverUrl`, `serverList`
- Missing a field = lost on app close

---

## API endpoints (server.js)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/stations` | All stations from topology |
| GET | `/api/routes` | All routes (real + drafts) |
| GET | `/api/schedule/:stationId` | Station dashboard data |
| GET | `/api/routes/:id` | Single route detail + timetable |
| GET/POST | `/api/server-url` | Get/set MTR server URL |
| GET/POST | `/api/prefs` | User preferences |
| GET | `/api/status` | Server status + version |
| GET | `/api/pending-changelog` | One-time changelog (deletes after serving) |
| POST | `/api/drafts` | Create draft route |
| PUT | `/api/drafts/:id` | Update draft route |
| DELETE | `/api/drafts/:id` | Delete draft route |
| GET | `/api/stations/:id/arrivals` | Live arrivals for train consist |

---

## Release process

1. Update `version` in `package.json`
2. Update `pending-changelog.json` with translations for all 7 languages (ru/en/de/fr/pl/pt/cs)
3. Close running Electron app (releases `app.asar` lock)
4. `npm run build` → creates `dist/MTRScheduleManager-Setup-x.x.x.exe`
5. Create GitHub Release with tag `vX.X.X`, attach `.exe` + `latest.yml` from `dist/`
6. `pending-changelog.json` ships in build — shown once on first launch after update

---

## Data directory

Stored in Electron `userData` (e.g. `%APPDATA%/MTR Schedule Manager/`):
- `prefs.json` — user settings
- `topology.json` — cached station/route topology
- `departures-cache.json` — cached departure times
- `drafts/` — draft routes as individual JSON files
- `pending-changelog.json` — shown once then deleted
