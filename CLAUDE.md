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
| `public/map.html` | Network-map viewer: template of the standalone HTML file + live `#v=` view in the system browser |
| `electron/titlebar.html` | Custom window title bar page (the window's own webContents; app lives in a WebContentsView below) |
| `public/titlebar.js` | Sends the page's theme colours to the title bar (`set-titlebar-theme` IPC) |
| `public/i18n-extra.js` | Translations for DE/FR/PL/PT/CS (merged into I18N at runtime) |
| `public/routeMarkers.js` | Route markers per transport type: shapes, icons, `RouteMarkers.html()` |
| `public/ui-next.css` | Experimental UI theme (only under `html.ui-next`), fonts in `public/vendor/fonts` |
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
- Favourites are bound to the MTR server: entries carry `server` (= `currentServerKey()`, i.e. `settings.serverUrl || DEFAULT_SERVER`) and `isFavOnThisServer` hides other servers' entries everywhere (☆ state, favourites bar). Legacy entries without `server` are adopted by the current server in `renderFavoritesBar` once its station list is loaded and the station exists there; until then (or if the station is gone) they show struck-through (`.fav-missing`) — a station of another server can't be selected, so ☆ can't remove it: every chip has its own × (`data-fav-remove`)
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
- Share («Поделиться», no external hosting — GitHub Pages and jsonblob.com publishing were removed in 1.2; jsonblob answered 403 anyway): (1) **HTML file** — `buildStandaloneHtml` fetches `map.html` + `schemeCore.js`, drops the lz-string tag, inlines the core and puts `toPublished()` JSON into `<script type="application/json" id="mapData">` (`<` escaped as `<`, `</script` in the core escaped, string replacements via functions because data may contain `$&`). Works offline from file://, on phones, on any host. (2) **Open in browser** — `POST /api/scheme-view {id, data}` (in-memory, max 20, rev counter) then `window.open(origin/map.html#v=<schemeId>)` → system browser; the page polls `GET /api/scheme-view/:id?rev=` every 1.5 s (204 = unchanged) and re-renders without resetting the view. After the first open, every `scheduleSave` also pushes (`scheduleViewPush`, 600 ms). Old `#m=` links still render where lz-string is present
- Export: `toSvgElement` (temporarily attached to the DOM for getBBox, bg rect, viewBox) → SVG download or canvas → PNG (scale 2, capped at 16000 px)
- Persisted in prefs.json as `networkSchemeProject` (model v1; anything without `v: 1` is ignored on load) + `networkSchemeUi` (`mode`, `types`, `live`) — wired into all three touch points via `networkSchemePrefsFields()` / `applyPersistedState`
- `GET /api/scheme-data` (`getSchemeData` in schedule.js): stations with world x/z = average of their PLATFORM coords over all routes (MTR gives x/z per route stop, i.e. per platform), routes with ordered `stationIds` + `reverseRouteId`. Drafts excluded (no coords). Ids pass only `SAFE_ID` (`/^[A-Za-z0-9_-]{1,64}$/`)
- **Node test scripts: never call `store.setTopology()`** — it `fs.writeFile`s `data/topology.json` asynchronously, and a script that exits/crashes mid-write leaves it truncated (this wiped the dev topology cache once). Patch the getter instead: `store.getTopology = () => JSON.parse(fs.readFileSync("data/topology.json"))`
- Generator `NetworkScheme.buildFromMtr(data, types, prevProject, {alignTol})` is pure (testable in node via `vm` with schemeCore.js loaded first): forward+reverse = one line; short-turn variants (same color+number, contiguous sub-path) fold into the longest route; scale = median inter-station distance → `spacingCells` grid cells: 3, or more for dense networks so the 90th-percentile bundle (lines per hop × (lineWidth + laneGap) × 1.2) fits between stations (buses: 4 cells; capped at 8). Only on first build — rebuilds reuse `mtrMeta.scale`
- Straightening (toolbar «Выравнивание», `ui.alignTol` 0/10/15/20°, default 15): `straighten` relaxes hops within the tolerance of 0/45/90° in RAW (pre-grid) coordinates — 40 passes, the perpendicular error split between the ends, already-placed stations locked; then grid snap (collisions spiral to the nearest free cell); then `gridAlign` nudges NEW stations by one cell while it increases the number of exactly octilinear alignable hops (snapping alone breaks ~1-cell diagonals). On the test network straight hops go 50% → 80% (15°) → 92% (20°). Only new stations move — rebuilding an existing map keeps positions; start from an empty map to re-straighten everything
- Remaining non-octilinear hops get ONE elbow, chosen once per station pair (cached by sorted pair key) so lines sharing a hop share the trace. `buildPath` keeps vertices at stations even when collinear (station drag relies on it)
- Merge: generated objects have prefixed ids `mtr-line-<routeId>` / `mtr-st-<stationId>` / `mtr-tr-<minStationId>` plus `mtrRouteIds`/`mtrStationIds`/`mtrStationId`/`mtrName`; the coordinate transform is stored as `mtrMeta` and reused so new stations land consistently. On rebuild: existing objects keep position/style/user names (MTR renames propagate only if the name wasn't edited — compared via `mtrName`), line points are kept unless the station sequence changed, new objects are added, mtr-objects no longer selected are removed, user-drawn objects (no prefix) are untouched. Generation pushes history first → Ctrl+Z undoes it

### Network map — 1.2 additions (labels, shapes, groups, schemes, live publish)
- **Labels** (`placeLabels` in schemeCore.js): for stations with `label.pos === "auto"` picks one of 8 directions (close, then +0.9 em further), then tilt ±45°, greedily (busiest stations first), then a second pass for labels that still cost ≥ one line crossing. Costs (`W_*` constants): other label 1000, marker box 700, end badge 500, each DISTINCT line crossed 60 (it used to be 40 per line SAMPLE, so crossing a 6-line bundle "cost" more than sitting on another label), far 30, tilt 250. Text width is measured with canvas `measureText` (cached; estimate fallback without DOM). Marker obstacles are real OBBs from `markerBox` (+ `reach(u)` support function: the label gap depends on direction, a long stick across a bundle no longer pushes side labels far away). End badges are laid out first (`layoutEndBadges`) and are obstacles too. Manual labels (`pos` ≠ auto) are fixed obstacles. `style.labelAuto=false` falls back to the old perpendicular default. The tick marker is drawn AFTER placement and points at the chosen side. `render` returns `{geos, offsetPts, labels}`
- **Style knobs** (`style`): `cornerRadius`, `laneGap`, `stationScale`, `stationFill/Stroke`, `transferScale`, `labelAuto`. Geometry helpers take them from `p.style` (no module constants any more). Per station: `fill`, `stroke`, `strokeW`, `size`, `labelSize`, `labelColor`; styles `square`/`diamond` added
- **Express lines**: `expandExpress` in networkScheme.js — a hop A→C that another selected line covers as A…B…C (2–14 stations) is routed through that chain, so the express shares the bundle lanes; skipped stations get `passLineIds` (line has `mtrPassIds`). Renderer draws the line over the station marker (`.sc-through`) without a tick, CLIPPED to the marker box (`clipPath`, ids `sc-pass-<renderSeq>-<i>`). `sameRoute` also compares `mtrPassIds`. The chain must pass `expressChainOk` (world coords): no intermediate is a stop of the express itself, intermediates progress monotonically along A→C within 20% lateral offset, chain length ≤ 1.25 × |AC|. Without it 212 of 222 bus "expansions" were detours up to 15× long — the main source of "lines drawn as loops"
- **Gap compression** (`compressAxis`, toolbar «Сжатие пустот», `ui.compress` cells): sorted-coordinate gaps > N cells are shrunk to N on x and y independently; applies only to NEW stations (existing keep their cells), so use an empty map to recompress everything
- **Shapes** (`project.shapes`: rect/ellipse/line/text; `layer` back|front, `rot`, fill/stroke "none" allowed): tools R/O/D/A, 8 resize handles + rotation knob (resize is computed in the unrotated frame, centre re-rotated), z-order buttons, duplicate. Published as `sh` arrays
- **Selection**: empty-area drag = marquee (pan = Space / middle / right button); Shift+click toggles. `group = {stations,nodes,shapes}`; group drag re-applies the total delta to the drag-start snapshot (`applyGroupMove`). Copy/paste style = `styleClip` (Ctrl+Shift+C/V). `askText()` replaces prompt() (not supported in Electron); F2 / dblclick on label renames
- **Several maps**: `schemes[{id,name,project,types,publish}]` + `activeId`; `project` is the live reference of the active one (`syncActive()` before persisting/switching). Prefs: `networkSchemes` + `networkSchemeActive` (plus legacy `networkSchemeProject` = active). `types` are per scheme
- **Board insert**: «В табло» renders PNG and calls `BoardEditor.insertImageDataUrl`
- **Station marker**: auto style is always a rounded rectangle across the bundle (`pillMetrics`): plain station = thin stick (length = lanes of the bundle + pad); T/crossing = width from the main direction lane count, height from the lane count of the other directions (lanes measured in each line own frame, so approach angle does not inflate it). Circle/square/diamond/tick only when chosen explicitly
- **Merging lines**: `line.group` (shared id). `mergeLines()` copies master colour/number/width/dash/name, `relayoutLanes()` recomputes lanes from geometry (vertices act as stations for `assignLanes`; applied to MTR + grouped lines only); `assignLanes` gives group members one shared lane per hop (`dups`). Legend shows one row per group. UI: ticks in the lines list of the scheme props
- **Concentric corners**: `offsetPolylineVar(pts, offs, R)` attaches `radii` — each lane rounds with R ± its offset (outer side larger), so bundle lanes stay parallel through bends instead of weaving into knots. `roundedPath` reads `pts.radii`
- **Hiding lines**: `line.hidden` (eye button / per-type chips in the lines list). `visibleProject()` drops hidden lines, stations whose lines are all hidden and orphaned transfers; used by `render` and `toPublished`; `relayoutLanes` skips hidden lines so lanes close up. Dense networks (66 bus routes in one core) are unreadable otherwise
- **Editing gotcha**: when patching networkScheme.js with range-replace scripts, `indexOf` takes the FIRST match — a duplicated function name silently deletes the wrong span (lost the whole «Правки» block once)

### Network map — render-engine revision (loops, overlaps, lines over stations)
- **Offset inversion** (`offsetPolylineVar`): with a wide bundle on a short segment the inner-side join point lands BEYOND the offset segment's end, so the drawn line went forward-back-forward (small loops on dense maps). Each segment is now an offset line with a span `[t0, t1]` set by its joins; a segment with `t1 < t0` is dropped and its neighbours are joined directly, repeated until none is inverted (first/last segment: the line starts/ends on the neighbour). Joins: intersection; collinear same lane = one point; lane change on a straight = jog; U-turn / too sharp (miter > 4×offset) = two points
- **Lane limit** `MAX_LANE = 40` in normalize (was ±8: bundles of 17+ lines collapsed onto the same lane)
- **Same line twice on a hop** (route doubling back) = ONE lane (`dups`), not two — it was drawn as a narrow loop. The old code only did this for `line.group`
- **Consistent lane order** (`assignLanes`): hops are ordered greedily from the most-connected one; each hop takes the relative order of lines it shares with already-ordered neighbour hops (via `through` = lines going g→v→h, transformed by `sIn`/`sOut` canonical-frame signs, weight 3) plus `cmp` (weight 1), ranked by Copeland score. Plain per-hop `sort(cmp)` is non-transitive for 3+ lines and flipped lines at every station in dense corridors (bus network: 251 side flips → 24, remaining ones are necessary crossings)
- **Hidden lines** don't take lanes in `buildFromMtr` either (only `relayoutLanes` skipped them, so a rebuild left holes in bundles)
- **Untangle** (`untangle`, after `gridAlign`): a hop whose lattice route passes through ANOTHER station's cell looks like a stop that isn't there / a line over the station. New stations involved are moved to a free neighbour cell while that lowers the global count (×10) minus aligned-hop count. `buildPath` elbow choice scores the cells it passes (`through`), not just the elbow point. Fresh bus build: 42 → 0 such passes
- **No stations on bends** (`slideOffBends`, after `untangle`): a NEW station where any of its lines turns is slid along an arm that ALL its lines share, by k cells (enough for the inner lane's arc + R + marker to clear it, at most half the arm), and the bend stays at the old cell as a plain vertex (`via` = fixed hop points for `buildPath`; the old cell stays in `occ`). Not possible at real junctions (lines leave in different directions — no common arm) or with arms < 2 cells: test network 69 → 22, buses 125 → 43. Existing stations never move
- **Junction vertices** (`withJunctions`, right before `assignLanes`): a non-station vertex where lines through it leave in different directions (such a former bend) is inserted into `_fullIds` as node `~x,y`, so the station→bend stretch is ONE hop/bundle. Without it two hops shared that segment and their lanes overlapped/crossed. Derived from geometry, so a rebuild with kept points gives identical lanes (it didn't when the nodes came from the generator only)
- **Lane inheritance** (`inheritFrom` in `assignLanes` + a post-pass): a hop ALL of whose lines arrive through node v from one already-ordered hop g takes g's order (no swap at v). At a `~` junction it also takes g's exact POSITIONS — recentring there drew a visible step/zigzag; if the leaving line was in the middle, the hole lasts until the next station (the pill hides the recentre). `relayoutLanes` names non-station vertices `~x,y` too. Measured with "flips" (pair order changes over consecutive segments) and "jogs" (lane change on a straight non-station vertex): user's tram map 4/22 → 0/0
- **Unbend** (`unbend`, after `untangle`): local search moving NEW stations one cell when it lowers bends of their lines (elbows in hops, bend at the station, bend at the neighbour stations if their next hop is straight; foreign stations on the route ×10). Fixes the V-kink "station one cell beside its corridor". Processed most-bent first, otherwise the neighbour adapts to the kinked station and the corridor shifts with it. `forcedThrough` skips hops whose bbox doesn't contain the cell (it made a full build 4 s)
- `buildPath` elbow choice also looks AHEAD: if the next hop is straight, arriving in its direction is preferred (else the station ends up on a bend)
- **Same number = one line** (`groupRoutes` + `numberKey`): a numbered route folds into a line of the same number+type when its stations are a contiguous piece of it (colour ignored); remaining same-number lines (branches) get `group = "n:<type>|<number>"` (shared lane, one legend row). Colour + name come from the FIRST route in MTR order (`g.first`), applied only when the line is first grouped — later edits survive rebuilds. A manual group is never overridden. Caveat: "unmerge" clears `group`, so the next rebuild regroups it
- **Min. spacing** (toolbar «Мин. расстояние», `ui.minGap` ∈ `MIN_GAPS` cells, 0 = off): all placement steps go through `cellFree(occ, c, self)` — `occ` carries `pos`/`grid`/`minGap` as properties; Chebyshev distance < minGap to any station is blocked. On the first build the scale also grows so the typical hop is minGap + 1 (with exactly minGap a bent station had no room to slide). Only new stations
- **Station marker extent** (`pillMetrics`): offsets are measured along the CANONICAL normal; in each line's own frame two directions of one route (lanes +2.5 and −2.5) looked identical and the pill missed the outer lanes. `stationGeometry` also adds the nearest point of the line's DRAWN offset polyline (`drawn.offsetPts`), so terminating lines end inside the marker
- **Overlapping hops** (`splitOverlaps`, before `withJunctions`; also in `relayoutLanes`): when one line's vertex (e.g. its elbow) lies ON another line's straight segment and they continue together, that vertex is inserted into the other line (via `insertPoint`), so the shared stretch becomes one hop → one bundle. Before, a bus line's corner sat on a green bundle's segment and it was drawn in the MIDDLE of that bundle, crossing a lane
- At a STATION a subset hop also keeps its source positions when they are contiguous and the bundle's offset from the axis is ≤ 1 lane (`inheritFrom`): a lone line after a split otherwise stepped right at a thin marker
- At `~` junctions where lines both join and leave, continuing lines keep their positions and new ones are added at the edge (post-pass), unless the Copeland order put a newcomer between them
- Tried and REVERTED: moving lane swaps at stations to the middle of the next hop. Most remaining in-station swaps are at stations where the whole bundle bends (bus: 21 of 35), the straight cases were few, and it made rebuilds unstable on the full network
- **Editor: labels and route-number blocks are draggable.** Labels have `data-kind="label"` (no longer "station"): dragging one sets `label.dx/dy`; an auto label is first frozen in place (`freezeLabel`: the direction the auto-placer chose + its "far" offset, from `lastDrawn` = last `C().render` result). The end-of-line badge block has `data-kind="badge"`: dragging sets `st.badge.dx/dy`; `st.badge.hide` hides it (station props: «Номера маршрутов», reset buttons). Both are published (`st` array items 16–20). Badge side is now chosen automatically from 4 candidates (out / across / across / in) — the first one where no line passes under the numbers (`segHitsBox`)
- **Editor snapping** (`smartSnap`): while dragging a station / node / vertex / shape / legend, x or y sticks to another station or line vertex in view (8 screen px), and grid objects also stick to the 45° diagonal from their line neighbours. Dashed `.sc-guide` lines show it; Alt disables. Labels and badges are free
- **Map scale** («Масштаб схемы» −/+ in the scheme props, `scaleMap`): multiplies ALL coordinates AND `project.grid` by f (0.8 / 1.25), plus `mtrMeta.scale`, `mtrMeta.grid` and the compression map — stations stay on (the new) grid, octilinear stays exact, line widths/labels keep their size, rebuild adds new stations in the same system. Grid must stay within normalize's 8..96
- Generated lines are always `dash: "solid"` (buses used to be dashed)
- **Concentric corners** (`shareCornerRadii`, `roundedPath`): corners are SVG arcs (`A`), `radii[i]` = circle radius (null = default R / tan(θ/2), the old look). `offsetPolylineVar` returns `corners` (vertex+directions key, outward offset); for each key one centre radius Rc ≥ R/tan(θ/2) and ≥ rMin − inner offset (rMin = max(lineWidth, 0.35 R)), capped by segment room but never below the inner minimum. Lane radius = Rc + outward offset → same centre, no holes, no square inner corners
- Lab checks used during the revision (worth repeating after engine changes): self-intersections of offset polylines vs raw, hairpins (>120° turns) vs raw, label/label and label/marker overlaps from real `getBBox`, lines passing within 0.5 grid of a foreign station, side flips of line pairs across consecutive segments. Existing saved schemes keep old geometry (bogus express routes, old lanes) until «Построить из MTR» is pressed again; the new spacing applies only to a scheme built from empty

### Custom window title bar (Electron)
- `BrowserWindow` with `titleBarStyle: "hidden"` + `titleBarOverlay` (Win/Linux: native min/max/close drawn by the OS in our colours; macOS: traffic lights). The window's OWN webContents loads `electron/titlebar.html` (logo + name, whole page is a drag region, sandboxed, no preload); the app runs in a `WebContentsView` (`appView`) laid out at `y = TITLEBAR_H` (34) by `layoutAppView` (0 in fullscreen). A separate view instead of a strip inside index.html, so the page keeps its full viewport and every `100vh` layout stays correct
- Everything that used `mainWindow.webContents` for the APP now uses `appView.webContents` (load URL/loading.html, F12, `setWindowOpenHandler`, `show-changelog`). The title bar page's viewport is the whole window (hidden under the view) — its bar height is explicit (`?h=`), never `100%`
- Closing: a window close does NOT unload a child view's page, so `beforeunload` (prefs save) wouldn't run. `close` handler prevents, calls `appView.webContents.close({ waitForBeforeUnload: true })`, closes the window on `destroyed` (3 s fallback)
- Colours: `public/titlebar.js` reads `--bg/--text/--muted/--accent` from the page and sends `set-titlebar-theme` (re-sent on every `<html>` class change, e.g. ui-next toggle); main validates `#hex`, calls `setTitleBarOverlay` and `applyTheme()` in the title bar page
- **Drag region ONLY on `.bar`, never on `html/body`**: the title bar page spans the whole window under the app view, and on Windows `-webkit-app-region: drag` is a window-level hit-test — with drag on body the WHOLE window answered HTCAPTION and the app stopped receiving clicks. Check with `WM_NCHITTEST` (bar = 2, below = 1)
- New UI (`layout: "next"` in the same IPC message): bar is 40px (`TITLEBAR_H_NEXT`, `titlebarH` re-laid out live), glyph in text colour, name centred, MTR status on the right — text from `#statusBadge.dataset.next` (short string set in `refreshStatus`), validated/capped in main, rendered with `textContent`. At startup main reads `experimentalUi` from prefs.json (`readPrefFlag`) so the bar and `loading.html?layout=next` (mockup splash) are right before the page loads. `titlebar.js` adds `html.has-titlebar` — without it (browser) the status badge moves into the sidebar

### Experimental UI (Settings → Interface)
- `settings.experimentalUi` (default false) toggles the `ui-next` class on `<html>`; `public/ui-next.css` styles everything under `html.ui-next` and nothing else, so the classic look is untouched. Same DOM and JS — it is a skin + layout (sidebar from `nav.tabs` via `order`, topbar as page header, `main` without max-width), not a second UI
- Persisted through all three prefs touch points (`savePrefsToServer`, `buildPrefsPayload`, `loadPrefsFromServer`); the toggle is wired before `initNotifSettings`' early return, like the beta toggle
- To avoid a flash of the classic look at startup, an inline script in `index.html` `<head>` does a SYNC `GET /api/prefs` and adds the class before first paint. localStorage can't be used: Electron runs the server on a random port (PORT=0), so the origin changes every launch
- Nav icons are CSS masks on `.tab-btn::before` (`--nx-ic` data-URI SVG). `applyI18n` overwrites the `textContent` of anything with `data-i18n`, so markup inside a `.tab-btn` is only allowed when the label itself is a child with `data-i18n` (the problems item: `.tab-label` + `#nextProblemsCount` badge). Page title in the header = active item's label, for the station board = station name (`updateNextPageTitle`, called from `switchToTab`, `restoreFromUrlHash`, `applyI18n`)
- Spec of the mockups (Claude Design canvas) with per-element status: `docs/ui-next-spec.md`. All new-UI logic lives in the «Новый интерфейс (ui-next)» block of app.js
- **Section tools move into the header**: `syncNextLayout()` (from `updateNextPageTitle`) moves the active tab's direct `.controls` into `#nextHeadTools`, the ☆ into `#nextTitleExtra`, dashboard zoom/reset into the board bar, `#graphLegend` into the graph bar (`nxMove` leaves a comment marker, `nxRestoreAll` puts everything back first — classic mode gets the original DOM). It also sets `body[data-nx-tab]` (`schedule|graph|routes|problems|scheme|boards|…`) and splits the «Редактор» tab into two menu items (`#nextNavScheme` with `data-board-mode="scheme"`; both share `data-tab="board"`, so `switchToTab` marks the first one — `syncNextLayout` fixes `.active`)
- New-UI-only renderers: board bar chips + «Конфликты» panel (`nextRenderBoardBar`/`nextRenderConflicts`, pairs from `state.conflictDetails`, fix = `setOverride` per trip like `autoResolveStation`), platform plates (`nextPlatformMeta`), now flag, graph «Рейс» panel (`nextShowTrip`, opened instead of the route card on a graph click; selection kept as `{routeId,t0}` because tref indexes change on re-render), routes accordion (`nextRenderRouteGroups` from `renderRouteList`, stations group first), route card extras (`nextRouteCardExtras`: subtitle, KPI, conflicts), problems KPI + scope «Избранное» (`state.nxProblemsScope`). Settings have NO own side menu (the app menu is enough): cards flow in CSS columns inside `.settings-cards` (columns on a height-less wrapper — on the fixed-height panel they overflowed sideways), `.settings-footer` spans all columns. Route objects carry `stationIds/firstStationId/lastStationId/terminus` — there is no `stations` array
- In the new UI a route type without its own marker setting is drawn as a parallelogram with the number (`routeMarkerDefault()` → `RouteMarkers.configFor(cfg, type, def)`); `applyExperimentalUi` re-renders markers
- Route card in the new look (`nextRouteCardHtml`, mockup «7 · Карточка маршрута» on the Design canvas): `renderRouteModal` branches on `isNextUi()` and builds a different body — header (marker, name, chips «в движении · N» / «правок: N», actions), left «паспорт» (KPI, line strip, consist slot `#nxcConsist`, details) and tabs Timetable / Stops / On the line / Conflicts (`state.nxCardTab`, switched by a delegated `[data-nxc-tab]` click, panes shown via `.nxc[data-tab]`). Buttons keep the classic ids (`reverseRouteBtn`, `openGraphForRouteBtn`, `createDraftFromRouteBtn`, `toggleFavoriteRouteBtn`, `resetRouteEditsBtn`, draft edit/delete), so the handlers below the innerHTML are shared; the classic «Действия» dropdown does not exist there. The late-loaded consist diagram goes into `#nxcConsist` (openRouteModal checks for it)
- `routeTripsNow(data, timetable)`: trips in progress now (by times incl. live deviation + override) and the «current» trip (in progress, else the next one). Positions on the strip are TIME fractions — stations are placed on the same time scale, so no distances are needed. The timetable marks that column `.tt-cur` and reached cells `.tt-passed` (classes are harmless in the classic look); «Сейчас» / opening the card scrolls to it (`nxcScrollToNow` — uses getBoundingClientRect, offsetLeft is relative to the modal, not the table)
- Conflict shift in the card: `openRouteModal` keeps `computeConflicts` `details` for our trips as `state.lastRouteConflictPairs` (`"t0|stationId"` → `{me, partners}`); `routeConflictFix` shifts OUR trip — later past the partner's departure + min interval if we arrive after it, earlier if before; worst partner wins, whole minutes, ≥1. The button (`[data-nxc-shift]`) does `pushUndoSnapshot` + `setOverride` (no turnaround chain, like the board panel) and reopens the card to recount
- Timetable cell z-index/position stay from style.css (JS transform sticky); ui-next only recolours — overriding position/z-index there put the deviation row over its label cell
- Elements that exist only in the new look carry `.next-only` (hidden by default)
- Dashboard train blocks keep the classic state language: inset ring `--eb-ring` (late amber, early mint, platform moved blue) + outer glow `--eb-glow` (conflict red ring + glow, edited yellow dashed outline + glow), composed in one `box-shadow` so late+conflict shows both; hover/pair/chain-hl add white/red light. Board legend mirrors them
- List badges (`nxRouteBadge`): routes without a number show `nxShortLabel` (first word, ≤7 chars, full name in `title`); stacks dedupe by visible label+colour (`nxUniqBadges`). Station rows: the stack spans grid columns 3–4, `.nx-cell-skip` keeps the child count for the narrow layout's `nth-child` hiding
- Title-bar status is a plain «MTR онлайн» — no "polled N s ago" counter
- Layouts from the mockups, still CSS over the same DOM: nav group «Расписания» (`.next-nav-group`, schedule/graph as indented sub-items, group highlighted via `:has(.tab-btn.active…)`); section names from the mockups via `data-i18n-next` on `.tab-btn` (applyI18n picks it when `ui-next` is on, so `applyExperimentalUi` re-runs applyI18n); favorites in the sidebar (`renderNextFavorites`, called from `renderFavoritesBar`; same `isFavOnThisServer` filter, × removes, missing stations struck out) while `#favoritesBar` is hidden; header = crumbs + title + lead (lead = the tab's first `p.hint`, which is hidden in the tab; for the station board = `#scheduleMeta`, followed by a MutationObserver); station board = filters | board | nearest arrivals as a right column (`.nb-row` turned into a departure-board grid); route card = centred popup window (see below); Problems = 4 full-height columns, always expanded
- Buttons: base button is dark with light text via `:where(html.ui-next) button` (specificity of plain `button`, so component classes keep their own background); only the ids in the `:is(#newDraftBtn…)` list are orange with #241651 text. Giving ALL buttons the dark ink colour (for orange) made every button with its own dark background unreadable (favourite chips)
- Fonts are bundled (offline app): DM Sans / DM Mono have NO Cyrillic, so `@font-face` uses unicode-range and Manrope supplies Cyrillic glyphs (`font-family: "DM Sans", "Manrope", …`). OFL licenses next to the files
- Palette: bg #0B0B0E, panel #141418, raised #1E1D24, text #FBE5DC, muted #A0928E, accent #F68349 (text on it #241651), live/now #D6FFF6, danger #FF6B81, warn #FFC86B — mostly via overriding style.css variables. Mockups: Design canvas artifact «MTR Schedule Manager — новый UI»
- App icon (`build/icon.png`, `icon-512.png`, `icon.ico`, `icon.svg`) is generated from the logo glyph; small ICO sizes use an enlarged glyph
- Updates don't recreate desktop/Start-menu shortcuts and Explorer caches their icon, so after the icon change shortcuts kept the old one although the exe had the new icon. `build/installer.nsh` (`nsis.include`) calls `SHChangeNotify(SHCNE_ASSOCCHANGED)` in `customInstall` to flush the cache

### Route markers (Settings → «Метки маршрутов»)
- `public/routeMarkers.js` (global `RouteMarkers`, loaded before app.js, no app.js deps): per route TYPE a `shape` (circle, parallelogram, plaque, capsule, square, diamond, hexagon, triangle) and `content` (`none` | `number` | `icon:<train|metro|tram|bus|cable|ship|plane|fast>`). `RouteMarkers.html({type, color, number, size, cfg})` returns a `<span class="rmk rmk-<shape> rmk-<size> …">` filled with the route colour (`--rmk`, only `#hex` passes), text/icon colour picked by luminance. Sizes: `sm` (legends, route filter list — shape only), `md` (tables, nearest arrivals, problem cards, type filters), `lg` (route card header, settings preview). Default = circle + none = the old colour dot, so nothing changes until the user picks something
- `settings.routeMarkers` `{ [type]: {shape, content} }`, persisted through all three prefs touch points. app.js wrappers: `routeMarker(type, color, number, size)`, `routeTypeName(type)` (i18n `rtype_<type>`, falls back to the raw code), `routeMarkerShowsNumber(type)` (nearest arrivals skip the duplicate number), `rerenderRouteMarkers()`, `renderRouteMarkersSettings()` (called from `initSettingsUI` and from `populateRouteTypeFilter` once routes are loaded — rows = types present on this server + configured ones; before routes load it lists the standard MTR types)
- Used at: dashboard route filter list, graph legend, routes table, route card header, nearest arrivals, Problems route cards, type filter lists (dashboard + graph, neutral colour), route type select (friendly names). Not used on dashboard blocks / graph lines (they have their own geometry)
- Shapes are CSS `clip-path` / `border-radius` on an inline-flex span, so the width grows with the number; diamond/hexagon/triangle have explicit sizes per `md`/`lg` (they clip long numbers otherwise)
- **Offscreen screenshot scripts: never mutate `settings` in the page.** Closing the window fires `beforeunload` → `buildPrefsPayload` → the in-memory settings are written to `data/prefs.json` (that leaked `experimentalUi: true` into dev prefs twice). Add classes / call render functions only

### Network map — 1.2.0 final additions
- **Stumps** (`resolveStyle` → `"stump"`): a plain station (not end/transfer, all its lines have the same two neighbours, straight run ≥ 1.3 R and no lane jog on both sides — `straightAround`) is drawn as one stump per line: width = that line's width, from the line axis outward to the label side, placed on the DRAWN offset polyline (`geo.offsetPts`), no stroke (a stroke overshoots the line; a stump edge coinciding with the line's far edge gave a light seam). Pass-through (express) overlay is skipped for stump/tick
- **No stations on bends** (`offBend` in schemeCore): when ALL lines at a station turn the same way, the marker moves along the longer arm past the end of the rounded corner, distance = R + (outer lane offset + w/2)·tan(turn/2) + margin. Selection ring / live ring use `geo.c` (`markPos`)
- **Lane pitch is ONE per map** (`computePitch`, widest line + gap, minus 0.4 px when gap < 1 so neighbours overlap instead of leaving hairline seams). `compactLanes` (after `assignLanes`) closes holes in a bundle only where the lane change lands on a bend, never on a straight vertex (that made zigzags at stations)
- **Interchange styles** (`TRANSFER_STYLES` bar/capsule/dumbbell/curve/dashed/none): `style.transferStyle` for the map, `transfer.style` per transfer object, `station.transferStyle` per station ("" = map default, which is bar). Transfer objects draw connectors (`drawTransfer`; capsule/dumbbell make their stations `"bare"`). A single station with ≥2 lines at a junction maps the same setting to its own look: capsule → `pill2`, dumbbell → `ring` (one circle per line ON its lane, diameter = lane pitch, straight bridge), curve → `circ`, dashed → `pilld`, none → stumps. Published: `s[11]`, `tr` items `[ids, style]`, station item 21
- **Line types** `rail` (solid edges + dashed centre) and `dashdot` appended to `DASHES` (published as the name, so order only matters for the select)
- **Map scale buttons are ×2 / ÷2 only** (`scaleMap`): integer factors keep everything on the grid and 45° exact; fractional scale + rounding made staircases. ÷2 is refused unless all points sit on even cells
- **Station scheme from the board generator**: `BoardEditor.insertStationScheme` → `NetworkScheme.createStationScheme(stationId)` builds a NEW scheme from all routes through the station (all types), opens the scheme editor; «В табло» sends it back as an image
- Merge keeps the colour/width/dash of the FIRST line the user ticked (`mergePick` order); grouped lines with the same path are drawn once; dragging a vertex of a grouped line moves it in every member
- Hotkeys use `e.code` (Ctrl+Z/Y, tool letters, Ctrl+K) — `e.key` is a Cyrillic letter on the Russian layout. Esc clears the selection AND redraws the overlay; `askText` focuses its field after the mousedown that opened it
- **Experimental UI**: long page leads and settings hints are folded into «?» buttons (`nxFoldHints`, `#nextHelp`); settings are a 3-column grid with route markers spanning the right column. Test scripts that touch the editor must not click «Построить из MTR» on the dev `data/prefs.json` — back it up first

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
| POST / GET | `/api/scheme-view`, `/api/scheme-view/:id` | In-memory map for «Open in browser» (map.html#v=), polled by rev |

---

## Release process

1. Update `version` in `package.json`
2. Update `pending-changelog.json` with translations for all 7 languages (ru/en/de/fr/pl/pt/cs)
3. Commit + push to `main`, then push tag `vX.X.X` — CI (`.github/workflows/build.yml`) builds Windows/macOS/Linux and attaches them to the GitHub Release automatically (release is created as draft — publish manually)
4. `pending-changelog.json` ships in build — shown once on first launch after update

macOS: ONE job on `macos-latest` builds both `--x64 --arm64` (cross-build, the app has no native modules). Separate Intel jobs on `macos-13` never got a runner (queued 24 h, then cancelled — 1.2.0 shipped arm64 only), and two mac jobs would also overwrite each other's `latest-mac.yml` in the release.

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

### Network map — 1.2.1 changes
- **Z-zigzags / micro-zigzags**: `smoothLanes(p)` (schemeCore, run per render, result in non-enumerable `p._lanes`, read through `lanesOf`; model `lanes` untouched, so old schemes benefit without a rebuild). Bundles are modelled GEOMETRICALLY: every segment goes into a «corridor» (same supporting line) with its interval and canonical lane; `laneOk` allows a lane only if no foreign line on the overlapping part is closer than a whole lane (half-lane overlaps!), a same-group member stays on the same lane or ≥1 away, and the bundle stays contiguous (no holes). Comparing segments by identical endpoints (first version) missed neighbours with an extra vertex and put lines half a lane on top of each other; skipping the contiguity check left holes («линии не прилегают»). Phases: (1) short bumps/stairs (< `SMOOTH_LEN` pitches) onto the neighbour lane; (2) a lane change on a STRAIGHT vertex is moved to the nearest bend of that line (offset lines just intersect there — no step); (3) bundle recentring at a station: all lines of the corridor on one side are shifted together up to their next bend, accepted only if laneOk holds and the number of straight jogs drops. What remains happens inside stations: `offsetPolylineVar(..., steep, steepLen)` makes those jogs steep (0.15 × line width) and `pillMetrics` thickens the pill (≥ 1.4 × width) when a line jogs there (`it.jog`), so the step is hidden under the marker. Measure with a geometric checker (overlaps <1 lane, holes >1 lane, straight jogs): user's tram map 29 → 19 straight jogs, overlaps/holes = 1.2.0 level
- **Corner gaps on thick lines**: in `shareCornerRadii` the old `rc = max(min(want,cap), rMin − inner)` forced the shared radius past the room, so lanes were clamped to different `tt` and stopped being concentric (gap wedges from width ≈ 10). Now `rc = min(want, cap)`; if the innermost lane would get radius < 0.5 the WHOLE corner goes sharp (radius 0.5 for all lanes) — never a mix of arcs and sharp lanes
- **Merged lines + «сдвиг в пучке»**: `l.offset` is multiplied by `groupSignOf(p, l)` (±1 relative to the first line of the group, by common segments' direction) so members that run in opposite directions move the SAME way
- **Stumps**: length from the line axis is capped at `th/2 + min(tick, th)` — they no longer stretch to the common edge when lines are far apart
- **T-junction marker** (`pillMetrics`, non-simple case): frame = bounding box of all lane points in the axis system (lines' axes + 0/90°) with the smallest area, prefers axis-aligned — no more diagonal sticks
- **Transfer styles**: added `london` (UI: «Белые кольца»), `moscow` («Цветные кольца с мостиком»), `square` («Квадраты»), `hub` (one circle with colour sectors). UI labels carry no city names. Every style has its OWN station marker (`NODE_STYLES`: capsule→`pill2`, dumbbell→`ring`, curve→`circ`, dashed→`pilld`, london→`ringw`, moscow→`ringm`, square→`ringq`, hub→`hub`, none→stumps only on a parallel bundle (`parallelBundle`), plain pill at a junction — stumps there stuck out as broken fragments), used both on a single multi-line node AND on stations of a transfer object (`resolveStyle(..., trMode)`, `trModeOf` in render); `drawTransfer` then only draws the connector UNDER the markers, between marker centres (`anchors` = `mk.box` centres). Only `OWN_MARKER_TRANSFERS` (capsule, hub) draw the whole thing themselves (stations `bare`). Before, several styles collapsed into the same marker (london/hub/curve = one circle, square = capsule, moscow = dumbbell), so switching looked like nothing changed
- **Circle nodes** (`ringMetrics` + `drawRingDots(kind)` for `ring`/`ringw`/`ringm`/`ringq`): always symmetric around the bundle centre (`pm.mid`) on an equal step ≥ 2r; exactly over each lane only when lanes are evenly spaced and wide enough. Layout: 1–2 → row; 3–4 → row only while it sticks out past the bundle by ≤ 0.6 r per side, else triangle 2+1 / square 2×2; 5+ → two rows (odd = hex 3+2, even = grid 3×2). The bridge is the hull of the dot centres: a filled plate for dumbbell / coloured rings, only bars along the hull for white rings / squares (a filled dark plate looked like a blob). The old layout used lane projections + staggered rows + a zigzag bridge through the dots in order → lopsided blobs
- **One dot per route**: dots are grouped by `line.group || line.id` (both directions / branches of one number), position = mean projection of all their lane points; two groups merge only if they are the same colour on the same lane of the same ARM (`it.pts[].arm`, direction the line leaves the station). Before, consecutive-after-sort + same colour + close was used, so a line turning at the station got two dots; a position-only merge wrongly joined different lines on opposite arms of a junction. Check: on the user's map dots == routes for every node in all dot styles
- **Zero-length segments** (duplicate vertex at a station, seen in user maps): `smoothLanes` now runs over deduplicated points (`keep` = indices of real segments) and expands the result back (a zero segment takes the previous real lane). A zero segment used to break phase 3 (`recs` null → the whole re-centring at that point was skipped), leaving a half-lane step at a plain station — visible when the station is drawn as stumps
- Phase 3 runs (`smoothLanes`) stop at a bend OR where the corridor's set of lines changes (`compAt`: owners just before vs just after the vertex differ). Running past a junction into a wider bundle always failed `laneOk`, so the step stayed
- `dumbbell2` («Гантель на линиях», node style `ring2`, `ringMetrics(..., small)`): the pre-revision small dots (coloured radius = half the lane pitch), always ONE row, each dot exactly at its lane's projection; spread on an equal step only when lanes collide (junction). Drawn in two passes (all dark discs, then all colour discs) so touching dots don't cut each other
- **i18n completeness**: DE/FR/PL/PT/CS silently fall back to English for any key missing in `i18n-extra.js` — 97 scheme keys (appearance fields, shapes, merge, several maps) were missing until 1.2.1. When adding keys to `I18N.en`, add them to all five extra blocks too (check: diff `Object.keys(I18N.en)` against each language)
- Route types counter (`renderTypes`) counts only selected types present on the current server — `ui.types` may keep types from another server / old scheme
- **Selection glow**: `render(..., {highlight:Set})` draws two translucent wide strokes under the lines in `.sc-glow`; the editor passes the selected line + its group (`highlightSet`)
- **Align in a line** (`alignGroupInLine`): group props button; farthest pair = ends, others projected, non-station vertices between selected stations removed, `relayoutLanes()`
- **Rebuild preview**: `generate()` builds first, `diffProjects` + `confirmRebuild` show added / removed / renamed lines, stations and transfers before applying (first build applies immediately)
- **Icons** (`public/mapIcons.js`, global `MapIcons`, loaded before schemeCore in index.html / map.html and inlined by `buildStandaloneHtml`): 18 categories × 3 glyphs × plate none/circle/square, drawn with DOM API only (glyph = list of `[tag, attrs]`, tokens `"c"`/`"b"` = colour / cut-out colour). On the map they are shapes of type `icon` (`icon`, `variant`, `plate`, `plateColor`, `img`; published as `sh` items 17–21). Tool «Значок» (I) places one; with the tool active and nothing selected the props panel edits `iconPick` (what the next one will be)
- **Custom images**: `importIconFile` → data-URL (raster downscaled to 512 px PNG via canvas; SVG kept as is — it is only ever shown through `<image>`, so no scripts run). `normalizeShape` accepts `img` only when it matches `IMG_RE` (png/jpeg/gif/webp/svg base64) and ≤ 600 KB. Library of imported images = `ui.customIcons` (≤ 30), persisted inside `networkSchemeUi`
- **Test scripts / offscreen checks**: don't click around in the dev app with real prefs — beforeunload writes the state back to `data/prefs.json`; undo/delete what you created before leaving
