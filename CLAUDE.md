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
  ├── desktop notifications (conflicts network-wide + delays, runNotificationChecks)
  └── persists prefs via /api/prefs

Editor tab (public/boardEditor.js)
  ├── fabric.js canvas (vendor/fabric.min.js 5.5.2) for printable timetables
  ├── inserts live station schedule as fabric groups (beRole/beCol/beSection meta)
  ├── user edits stored as overrides in tableEdits — survive rebuilds/restart
  └── persists presets + canvas + lastSchedule inside common prefs.json
```

## Key files

| File | Purpose |
|------|---------|
| `server.js` | Express server, all API routes |
| `config.js` | BASE_URL, PORT, DATA_DIR — change BASE_URL for different MTR servers |
| `src/schedule.js` | Core: buildStationSchedule, buildRouteGraph, conflict detection |
| `src/store.js` | In-memory store, disk persistence (topology.json, departures-cache.json) |
| `src/poller.js` | Background polling from MTR API |
| `public/app.js` | All frontend logic (~5000 lines) |
| `public/boardEditor.js` | Editor tab: fabric.js canvas for printable timetables |
| `public/vendor/` | fabric.min.js, lz-string.min.js, Monocraft.ttf (plain `<script>` includes) |
| `public/schemeCore.js` | Network map model + geometry + SVG renderer (shared by editor and map.html) |
| `public/networkScheme.js` | Editor tab «Схема сети»: map editor, MTR generator with merge, live data, export, publish |
| `public/map.html` | Standalone viewer for published map links (served by GitHub Pages and locally) |
| `public/i18n-extra.js` | Translations for DE/FR/PL/PT/CS (merged into I18N at runtime) |
| `public/index.html` | Single-page app shell |
| `.github/workflows/build.yml` | CI: Win/mac/Linux builds on every push to main; publishes on `v*` tags |
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
- `effArrival` / `tripOriginMs` are UTC ms; blocks are positioned at `(toDisplayMs(ms) / MS_PER_DAY) * TIMELINE_WIDTH`
- Since v1.1.1 graphs render **from local midnight to local midnight**: axis ticks 00:00–24:00 mean user-local time, positions are shifted by `displayShiftMs()` = `(currentTzOffsetMin() − serverTzOffsetMin) * 60000` (same transform as `formatLocal`, so the axis label under a train matches its displayed time)
- Train graph: shift applied inside `xScale` WITHOUT normalization (paths must stay monotonic); midnight wrap = extra path copy at ±MS_PER_DAY. "Now" line and scroll-to-now go through `toDisplayMs`; drag deltas are relative — no shift
- `formatLocal(ms)` adds `currentTzOffsetMin() * 60000` for display only
- `formatUtc(ms)` — pure UTC display, used in timetable cells and axis tick labels
- Nearest-trains widget: `effArrival` already includes deviation — to show actual time with live deviation use `effArrival − e.deviationMs + effectiveDev`, never add deviation on top
- Route timetable cells: `trip.times` from the API already include live deviation — display planned time as `base − trip.deviationMs`, deviation separately in parens (`formatDeviationParen`)

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

### Turnaround chain (linked edits)
- Forward/reverse routes are linked through termini: arriving trip ≈ departing reverse trip (pairs built by `buildStationSchedule` at each terminus, 5 min tolerance + same platform)
- `GET /api/turnaround-chain?routeId=&t0=` (`getTurnaroundChain` in schedule.js) walks pairs at BOTH termini → full chain of trips that must move together; S19-like routes (never enter depot) chain the whole day and may close into a cycle (guarded by seen-set)
- Client `applyReverseShift` fetches the chain and applies the SAME absolute override to every trip (batched: `setOverride(..., true)` + one `persistOverrides`), then re-renders; falls back to one-hop pair link if server unreachable
- Shift-drag (whole route) uses `bumpRouteOverrideWithReverse` — bumps `reverseRouteId` too (from `/api/routes`, or lazily from the chain endpoint when `state.routes` not yet loaded)
- `getReverseRouteMap` is cached by (topology.fetchedAt + routes count) — it used to be recomputed O(n²) inside every `buildStationSchedule`
- Ctrl+click a dashboard block / graph line (or context menu item) highlights the whole chain: `state.chainHl` Set of `routeId:t0`, CSS classes `chain-hl`/`chain-dim`, Esc clears
- Train graph extras (renderGraph): turnaround connectors (`.graph-turnaround-link`, forward trip end → reverse trip start at same station, base-time tolerance 6 min) and conflict markers (`.graph-conflict-marker`): (a) same station+platform closer than minInterval (connector pairs excluded via `linkedPairs`), (b) overtakes — same-DIRECTION trips whose drawn polylines cross between stations, detected by segment-vs-segment intersection in (time, pixelY) space (`segIntersect`, using `yScale`-mapped Y so it's robust to different stopping patterns); one marker per trip pair at the crossing. Opposite-direction crossings are normal and never flagged. Conflicts collected into `state._graphConflicts` (kind station|overtake, `problem`/`solution` text); markers carry `data-cidx`, station conflicts also draw a faint `.graph-conflict-link`; graph mousemove shows a problem+solution tooltip on marker hover (priority over the trip-line tooltip). Needs `stationId`/`platformName` in graph points and `reverseRouteId` on graph routes (both served by `buildRouteGraph`)
- `#entryTooltip` is re-parented to `document.body` at startup — inside the schedule section it would be invisible on other tabs (hidden parent); it serves the dashboard blocks, graph trip lines AND graph conflict markers
- Dashboard route filter: `state.routeFilter` (Set of routeId, forward/reverse are separate routeIds = direction filter), applied alongside platform filter incl. conflict counting
- Dashboard train-type filter: `state.dashTypeFilter` (Set of `entry.routeType`, rebuilt per station), applied as `typeVisible(e.routeType)` next to platform + route filters. Mirrors the graph's `graphTypeFilter`
- Graph Y axis: after building `stationsForAxis` from the manual station filter, it is further narrowed to stations actually served by a currently-VISIBLE route (`stationIdsFromVisibleRoutes`, computed from `routesToShow` which is now derived BEFORE the axis) — hidden routes' stations don't clutter the axis. Falls back to the manual selection if that leaves nothing
- Graph Y-panel scroll sync: `#graphWrap` has a horizontal scrollbar (eats clientHeight) but `#graphYPanel` does not, so their max scrollTop differed and labels drifted at the bottom. Fixed by measuring `graphMaxScroll − panelMaxScroll` and adding exactly that as the panel's `padding-bottom`
- Graph right-click: `graphWrap` mousedown bails on `e.button !== 0` — otherwise a right-click counted as a no-move "click" on mouseup and opened the route card instead of the context menu
- `.dashboard-grid-scroll` is `overflow-y: hidden` (not `visible`): CSS silently promotes `visible`+`auto` to `auto`, which showed a phantom vertical scrollbar
- Dashboard hover: hovering a block adds `.eb-hover-focus` to it and `.eb-hover-pair` to its conflict partners (found via `state.conflictDetails` + `data-entry-key`), elevating z-index so a densely-packed pair pops out immediately; switches on every mousemove, cleared on mouseleave
- Conflict auto-resolve: `solveStationConflicts(rawEntries, minIntervalMs)` is a bounded greedy solver (MAX_ITER 300, per-trip cap ±20 min) that repeatedly shifts the LATER train of the earliest conflict right to exactly minInterval, freezing pairs it can't clear within the cap; `autoResolveStation(stationId)` fetches the schedule, runs it, and commits PER-TRIP overrides WITHOUT turnaround-chain alignment (chain alignment would overwrite independent shifts and blow up on S19 whole-day chains). Exposed as a "Resolve by shifting" button on Problem-areas station cards. Problem-areas also has a "Currently delayed" section from `/api/analytics/live-delays`

### Partial-overlap routes on the train graph
- `buildRouteGraph` returns `overlap: "full" | "partial"` per route. `full` = route passes through BOTH selected stations (the original behaviour). `partial` = "neighbour" route that misses A and/or B but runs along ≥2 stations of the corridor (step 2.5, after `stationUnion` is built from the full routes) — e.g. corridor A-B-C-D and a route running only B→C
- A partial route's segment spans its own first→last corridor station; direction comes from comparing corridor `distance` at those two ends (not from A/B indices, which don't exist for it)
- **The Y axis is built from FULL routes only**: step 3 skips partials, and step 4 drops a partial's points at stations outside `stationUnion` — so a neighbour is drawn only along the shared stations, with a straight line to the next common one, and its own stops never clutter the axis. A partial trip left with <2 points is skipped
- ≥2 shared stations is deliberate: a single shared station is just an interchange, not a shared stretch of track
- Client: `state.showPartial` (default **true**), "Show neighbouring routes" sidebar toggle, tagged in the legend via `graphPartialShort`; `isGraphRouteVisible` and the legend filter both honour it

### Other train-graph filters
- `state.showGraphConflicts` (default true) only gates *rendering* of `.graph-conflict-marker`/`.graph-conflict-link` — conflicts are still computed, because the tooltip and the context menu read `state._graphConflicts`
- `state.graphTypeFilter` (Set of `route.type`, rebuilt per station pair via `graphTypeFilterKey`) is checked FIRST in `isGraphRouteVisible`, before `graphRouteOverrides` — otherwise clicking a legend item would resurrect a route whose type is filtered out. Needs `type` on graph routes (served by `buildRouteGraph`)

### Context menu on the train graph
- The same `setupContextMenu` handles both `.entry-block[data-eidx]` (dashboard) and `[data-tref]` (graph trip line); for the graph it synthesises a dashboard-shaped `ctxEntry` from `state.graphTripRefs`, so the menu body is one code path
- Conflict shift suggestions: on the dashboard every conflict is at the SAME station, so `ctxEntry.effArrival` works. On the graph one trip conflicts at MANY stations, so `graphConflictPartners` attaches per-conflict `_meArrival`/`_meEnd` (+ `_stationName`) and the shift loop prefers those. Getting this wrong silently produced nonsense shifts computed against the first stop
- Suggestions with |shift| < 1 min are dropped and the list is capped (MAX_SUGGESTIONS) — a graph trip can otherwise generate a dozen entries

### Favorites
- Routes are favourited as a PAIR with their reverse (`favoriteRoutePairIds` via `reverseRouteId`); removing either direction removes both. A route without a reverse is handled as a single entry

### Route pairs in Problem areas
- All three route lists (conflicts-by-route, "Currently delayed", "Largest average delay") collapse forward+reverse into ONE card via `routePairKey`/`routePairMemberIds`/`routePairLabel` — one train on a turnaround, so both directions are late by the same amount
- Label = `name · ICE330/ICE332`, or a single number when both directions share it. The name is taken from one direction, so routes whose NAME encodes a direction ("A > B") show one of the two — the number rule is what the user specified
- Delay values are merged by MAX (they should be equal anyway); conflict station sets are merged by union

### Delay shown only ahead of the train (route card)
- `buildRouteTimetable` adds `relArrivalMs` per station = `t0raw + arrivalOffsets[k] + deviation` — ms from the MTR poll moment to that arrival, negative = already passed. Derived from the RAW relative `t0raw`, so there is no time-of-day/midnight wrapping to get wrong. Drafts get `null` (their `t0raw` is absolute — see `isDraftEntry`)
- The response also carries `polledAt` (= `departures.fetchedAt`, OUR clock), so the client compares `relArrivalMs < Date.now() - polledAt`
- The client only applies this when the poll is FRESH (`LIVE_FRESH_MS` 5 min). With a stale cache (MTR offline, snapshot can be days old) every station would look passed and deviations would vanish entirely — then it falls back to showing them everywhere
- `trip.deviationMs` must stay REAL for `plannedMs = base − dev`; only the rendered parenthetical is suppressed (`devShown`). Zeroing `dev` itself would shift the displayed planned time on passed stations

### Diagnostic report (bug reports)
- `_diagLog` ring buffer (top of app.js, installed BEFORE everything so it catches init errors) wraps `console.error`/`console.warn` and listens to `window` `error`/`unhandledrejection`, keeping the last `_DIAG_LOG_MAX` lines
- `buildDiagnosticReport()` assembles a readable text report (app/server status from `/api/status`, environment, settings without secrets, state counts, the log buffer); `downloadDiagnosticReport()` saves it. In Electron it uses a native Save dialog via the `save-diagnostic` IPC (`ipcMain.handle` in main.js + `saveDiagnostic` in preload); in the browser it falls back to a Blob download. "Bug-report diagnostic file" button in Settings
- Deliberately contains no credentials (the app has none) — safe to attach to a public bug report

### Network map (Editor tab → «Схема сети»)
- Own SVG editor, concept inspired by MURScheme but no code from it. Editor tab has a mode switch «Табло / Схема сети» (`#boardModeTimetable` / `#boardModeScheme`); layout = tools column | `#schemeSvg` | properties panel `#schemeProps`
- `schemeCore.js` (global `SchemeCore`) = model + geometry + renderer, shared by the editor AND `public/map.html` (published-link viewer) — no app.js dependencies. `normalize()` coerces any input (numbers finite, strings length-capped, colors `#hex` only); rendering is DOM-API only (`createElementNS`/`setAttribute`/`textContent`), NEVER innerHTML with map data — names come from the MTR server and published links come from anyone. The props panel follows the same rule (`h()` helper, `textContent`)
- Model v1: `{v, title, grid, view, style, lines[{id,name,number,color,width,dash,offset,points[{x,y}],lanes?}], stations[{id,name,sub,x,y,style,label{pos,angle},lineIds}], transfers[{stationIds}], legend, mtrMeta?}`. Stations are NOT bound to lines geometrically: a station's markers are drawn from `nearestOnPolyline` of each line in `lineIds` (within 0.75 grid). Dragging a station moves every vertex of its lines that coincides with it — so a station must be a VERTEX of its lines: the generator keeps collinear points at stations, and `anchorStation()` splices a vertex in at drag start for stations that sit mid-segment
- Bundles: `line.lanes[i]` = lane of polyline SEGMENT i (length = points − 1, step 0.5), set by the generator; `line.offset` is only the user's manual extra shift. Pixel offset of segment i = `(lanes[i] + offset) × (width + 1.5)` to the LEFT of the polyline direction. `offsetPolylineVar` joins segments with different offsets at the intersection of their offset lines (miter capped at 4×), and inserts a short 45° jog when the lane changes on a straight. Any code that splices `points` must go through `insertPoint`/`removePoint` in networkScheme.js, which keep `lanes` in sync (normalize drops `lanes` whose length doesn't match). Corners rounded by `roundedPath` (quadratic, radius 18 capped by half segment)
- Per-hop lanes are what fixes "holes" in bundles: a constant per-line offset leaves an empty lane wherever a line runs without the neighbour it was offset against. `assignLanes` centres every hop's bundle (lanes −(n−1)/2…+(n−1)/2) and orders lines to avoid crossings: for two lines it walks back along their common path to where they diverge — the one coming from further left gets the left lane; if they never diverge behind, it walks forward; else by line order. Lanes are stored in the hop's canonical (sorted-id) frame × the line's travel direction
- Anti-weaving rules in that comparator (each one was a real "lines swap sides at every station" bug): (1) the pair is compared in the TRAVEL FRAME OF THE REFERENCE LINE (lower order; `seqR`/`idxR` = reversed views) — in the hop's canonical frame "behind" pointed at alternating ends of the shared corridor from hop to hop, so when the two ends disagree the pair flipped at every station; (2) `walk()` treats a skip-stop (paths rejoin within 1–4 stations) as NOT a divergence; (3) angle differences < `MIN_ANGLE` (~3°) are layout noise, not a side. Check with a side-flip count over consecutive shared hops — it must be 0 (test network and the user's server both are)
- Station markers: `stationGeometry` puts the marker point `c` on the ROUNDED corner (`cornerShift` = midpoint of the quadratic in `roundedPath`) when the station is a bend vertex — otherwise ticks float off the curve. `lanePts` carry each lane's segment normal `n`. Pill: if every line at the station has the same set of segment axes (straight, or all turning together) → one capsule across `nrm` (the bisector on a bend); otherwise (T / crossing) → one capsule across the dominant axis, widened to cover the crossing lanes (never the farthest-pair diagonal — that rotated it, and never per-direction capsules — that drew "+" shapes)
- Line-end badges: `drawEndBadges` collects all lines ending at a station, dedupes by number+colour, and lays them out in one row (along the line for horizontal ends, centred across for vertical ends) — one badge per line used to stack on the same spot
- Editing with a line selected shows ITS vertices at its drawn (lane-offset) positions (`vertexDisplayPoints`), kind `vertex`, moving only that line (`sel = {kind:"line", id, vidx}`; Delete with `vidx` removes the point, not the line). With nothing selected, shared corner nodes (centreline) move every line through them
- Station style `auto`: ≥2 lines or in a transfer → white pill across the bundle; line end → circle; else → tick on the label side. Line number badges at line ends; labels with a halo in the bg color
- Corner handles: in the select tool (when zoom × grid ≥ 9) every NON-station vertex of every line gets a square handle; handles are deduped by position, so a bundle corner is ONE node and `moveNode` moves that vertex in all lines (selection `{kind:"node", x, y}`; Delete removes the vertex from every line through it)
- Tools: V select (drag stations/corner nodes/legend, drag empty = pan, dblclick line = add vertex, dblclick MTR station = `gotoStationSchedule()`), L line (45° snap from previous point, snaps to stations, Enter/dblclick finishes), S station (on a line within 0.5 grid → inserted as a vertex), T transfer (two clicks). Delete, Ctrl+Z/Y (snapshot stack of 60), Esc. Keys only when the scheme is visible and focus isn't in a field
- `gotoStationSchedule(stationId)` in app.js is shared with the route card's station links
- Live data (toolbar toggle, refresh 90 s): `/api/analytics/conflict-scan?ids=…&limit=200` (the `ids` param was added for this; chunked by 60) → red rings; `/api/analytics/live-delays` → pulsing red halo on lines whose `mtrRouteIds` are delayed
- Publish: `toPublished()` → compact arrays (no mtr* fields) → `LZString.compressToEncodedURIComponent` → `PUBLISH_BASE#m=…` (~20–25 KB for ~240 stations). `PUBLISH_BASE` = GitHub Pages of this repo serving `public/map.html` from the root of `main` (`.nojekyll` at repo root). **Pages must be enabled in repo settings (Deploy from branch → main → / root)**, and the viewer only exists there once merged to main. «Предпросмотр» opens the same hash on the local server's `/map.html`
- Export: `toSvgElement` (temporarily attached to the DOM for getBBox, bg rect, viewBox) → SVG download or canvas → PNG (scale 2, capped at 16000 px)
- Persisted in prefs.json as `networkSchemeProject` (model v1; anything without `v: 1` is ignored on load) + `networkSchemeUi` (`mode`, `types`, `live`) — wired into all three touch points via `networkSchemePrefsFields()` / `applyPersistedState`
- `GET /api/scheme-data` (`getSchemeData` in schedule.js): stations with world x/z = average of their PLATFORM coords over all routes (MTR gives x/z per route stop, i.e. per platform), routes with ordered `stationIds` + `reverseRouteId`. Drafts excluded (no coords). Ids pass only `SAFE_ID` (`/^[A-Za-z0-9_-]{1,64}$/`)
- **Node test scripts: never call `store.setTopology()`** — it `fs.writeFile`s `data/topology.json` asynchronously, and a script that exits/crashes mid-write leaves it truncated (this wiped the dev topology cache once). Patch the getter instead: `store.getTopology = () => JSON.parse(fs.readFileSync("data/topology.json"))`
- Generator `NetworkScheme.buildFromMtr(data, types, prevProject, {alignTol})` is pure (testable in node via `vm` with schemeCore.js loaded first): forward+reverse = one line; short-turn variants (same color+number, contiguous sub-path) fold into the longest route; scale = median inter-station distance → 3 grid cells
- Straightening (toolbar «Выравнивание», `ui.alignTol` 0/10/15/20°, default 15): `straighten` relaxes hops within the tolerance of 0/45/90° in RAW (pre-grid) coordinates — 40 passes, the perpendicular error split between the ends, already-placed stations locked; then grid snap (collisions spiral to the nearest free cell); then `gridAlign` nudges NEW stations by one cell while it increases the number of exactly octilinear alignable hops (snapping alone breaks ~1-cell diagonals). On the test network straight hops go 50% → 80% (15°) → 92% (20°). Only new stations move — rebuilding an existing map keeps positions; start from an empty map to re-straighten everything
- Remaining non-octilinear hops get ONE elbow, chosen once per station pair (cached by sorted pair key) so lines sharing a hop share the trace. `buildPath` keeps vertices at stations even when collinear (station drag relies on it)
- Merge: generated objects have prefixed ids `mtr-line-<routeId>` / `mtr-st-<stationId>` / `mtr-tr-<minStationId>` plus `mtrRouteIds`/`mtrStationIds`/`mtrStationId`/`mtrName`; the coordinate transform is stored as `mtrMeta` and reused so new stations land consistently. On rebuild: existing objects keep position/style/user names (MTR renames propagate only if the name wasn't edited — compared via `mtrName`), line points are kept unless the station sequence changed, new objects are added, mtr-objects no longer selected are removed, user-drawn objects (no prefix) are untouched. Generation pushes history first → Ctrl+Z undoes it

### Network map — 1.2 additions (labels, shapes, groups, schemes, live publish)
- **Labels** (`placeLabels` in schemeCore.js): for stations with `label.pos === "auto"` picks one of 8 directions × tilt (0/±45°) greedily (busiest stations first), penalising overlap with already placed labels (OBB SAT), line samples and other markers (spatial hash). Manual labels (`pos` ≠ auto) are fixed obstacles. `style.labelAuto=false` falls back to the old perpendicular default. The tick marker is drawn AFTER placement and points at the chosen side
- **Style knobs** (`style`): `cornerRadius`, `laneGap`, `stationScale`, `stationFill/Stroke`, `transferScale`, `labelAuto`. Geometry helpers take them from `p.style` (no module constants any more). Per station: `fill`, `stroke`, `strokeW`, `size`, `labelSize`, `labelColor`; styles `square`/`diamond` added
- **Express lines**: `expandExpress` in networkScheme.js — a hop A→C that another selected line covers as A…B…C (2–14 stations) is routed through that chain, so the express shares the bundle lanes; skipped stations get `passLineIds` (line has `mtrPassIds`). Renderer draws the line over the station marker (`.sc-through`) without a tick. `sameRoute` also compares `mtrPassIds`
- **Gap compression** (`compressAxis`, toolbar «Сжатие пустот», `ui.compress` cells): sorted-coordinate gaps > N cells are shrunk to N on x and y independently; applies only to NEW stations (existing keep their cells), so use an empty map to recompress everything
- **Shapes** (`project.shapes`: rect/ellipse/line/text; `layer` back|front, `rot`, fill/stroke "none" allowed): tools R/O/D/A, 8 resize handles + rotation knob (resize is computed in the unrotated frame, centre re-rotated), z-order buttons, duplicate. Published as `sh` arrays
- **Selection**: empty-area drag = marquee (pan = Space / middle / right button); Shift+click toggles. `group = {stations,nodes,shapes}`; group drag re-applies the total delta to the drag-start snapshot (`applyGroupMove`). Copy/paste style = `styleClip` (Ctrl+Shift+C/V). `askText()` replaces prompt() (not supported in Electron); F2 / dblclick on label renames
- **Several maps**: `schemes[{id,name,project,types,publish}]` + `activeId`; `project` is the live reference of the active one (`syncActive()` before persisting/switching). Prefs: `networkSchemes` + `networkSchemeActive` (plus legacy `networkSchemeProject` = active). `types` are per scheme
- **Board insert**: «В табло» renders PNG and calls `BoardEditor.insertImageDataUrl`
- **Live publish**: `POST /api/scheme-publish` (server.js) creates/updates a record on jsonblob.com (server-side fetch, id validated by `BLOB_ID`); link = `<viewerBase>#b=<id>`; `map.html` fetches `https://jsonblob.com/api/jsonBlob/<id>`. The service wasn't exercised against the live API when written — verify before relying on it
- **Station marker**: auto style is always a rounded rectangle across the bundle (`pillMetrics`): plain station = thin stick (length = lanes of the bundle + pad); T/crossing = width from the main direction lane count, height from the lane count of the other directions (lanes measured in each line own frame, so approach angle does not inflate it). Circle/square/diamond/tick only when chosen explicitly
- **Merging lines**: `line.group` (shared id). `mergeLines()` copies master colour/number/width/dash/name, `relayoutLanes()` recomputes lanes from geometry (vertices act as stations for `assignLanes`; applied to MTR + grouped lines only); `assignLanes` gives group members one shared lane per hop (`dups`). Legend shows one row per group. UI: ticks in the lines list of the scheme props
- **Concentric corners**: `offsetPolylineVar(pts, offs, R)` attaches `radii` — each lane rounds with R ± its offset (outer side larger), so bundle lanes stay parallel through bends instead of weaving into knots. `roundedPath` reads `pts.radii`
- **Hiding lines**: `line.hidden` (eye button / per-type chips in the lines list). `visibleProject()` drops hidden lines, stations whose lines are all hidden and orphaned transfers; used by `render` and `toPublished`; `relayoutLanes` skips hidden lines so lanes close up. Dense networks (66 bus routes in one core) are unreadable otherwise
- **Editing gotcha**: when patching networkScheme.js with range-replace scripts, `indexOf` takes the FIRST match — a duplicated function name silently deletes the wrong span (lost the whole «Правки» block once)

### Beta (pre-release) updates
- `settings.betaUpdates` (default false) → `autoUpdater.allowPrerelease` in electron/main.js. Read from `prefs.json` (`readBetaUpdatesPref`) at startup and flipped live via the `set-beta-updates` IPC channel, so no restart is needed
- A persisted setting needs THREE touch points, not two: `savePrefsToServer` + `buildPrefsPayload` (both save paths) AND `loadPrefsFromServer` (read-back). Missing the last one silently reverts the setting on every launch even though prefs.json has it — that was the beta-toggle "doesn't persist" bug (fixed in 1.2.0-beta.2)
- The toggle is wired BEFORE `initSettingsUI`'s early `return` — that return only guards the notification block, and putting the toggle after it would silently kill the switch

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
| GET | `/api/scheme-data` | Stations with world coords + routes, for the network-map generator |

---

## Release process

1. Update `version` in `package.json`
2. Update `pending-changelog.json` with translations for all 7 languages (ru/en/de/fr/pl/pt/cs)
3. Commit + push to `main`, then push tag `vX.X.X` — CI (`.github/workflows/build.yml`) builds Windows/macOS/Linux and attaches them to the GitHub Release automatically (release is created as draft — publish manually)
4. `pending-changelog.json` ships in build — shown once on first launch after update

Local Windows build still possible: close running Electron app (releases `app.asar` lock), then `npm run build`. macOS/Linux **cannot** be built on Windows — CI only.

### Repo hygiene
- `node_modules/`, `dist/`, `data/` are gitignored and **must stay untracked** — committed node_modules previously broke CI (Windows bin shims without exec bits shadowed real binaries on Linux/mac runners)
- CI runs on every push to `main` (artifacts only) and on `v*` tags (publishes to release)

---

## Data directory

Stored in Electron `userData` (e.g. `%APPDATA%/MTR Schedule Manager/`):
- `prefs.json` — user settings
- `topology.json` — cached station/route topology
- `departures-cache.json` — cached departure times
- `drafts/` — draft routes as individual JSON files
- `pending-changelog.json` — shown once then deleted
