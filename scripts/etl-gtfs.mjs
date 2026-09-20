#!/usr/bin/env node
/**
 * NaikApa ETL — GTFS TransJakarta -> SQLite + public/network.json
 *
 * Sumber data : https://gtfs.transjakarta.co.id/files/file_gtfs.zip (resmi)
 * Input       : data/gtfs.zip  (di-download otomatis jika belum ada)
 *               data/gtfs/     (di-extract otomatis jika belum ada)
 * Output      : data/naikapa.db        (SQLite lengkap, semua layanan)
 *               public/network.json    (jaringan untuk peta: BRT + Mikrotrans)
 *               public/planner.json    (graph trip planner: pola halte per rute)
 *
 * Jalankan    : node scripts/etl-gtfs.mjs
 */
import { DatabaseSync } from 'node:sqlite'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const DATA = join(ROOT, 'data')
const GTFS_DIR = join(DATA, 'gtfs')
const ZIP = join(DATA, 'gtfs.zip')
const DB_PATH = join(DATA, 'naikapa.db')
const OUT_JSON = join(ROOT, 'public', 'network.json')
const OUT_PLANNER = join(ROOT, 'public', 'planner.json')

const FEED_URL = 'https://gtfs.transjakarta.co.id/files/file_gtfs.zip'

/* ---------- util ---------- */

function ensureData() {
  mkdirSync(DATA, { recursive: true })
  if (!existsSync(GTFS_DIR)) {
    if (!existsSync(ZIP)) {
      console.log('⬇  download GTFS …')
      execSync(`curl -sL -o "${ZIP}" ${FEED_URL}`, { stdio: 'inherit', shell: 'bash' })
    }
    console.log('📂 extract …')
    execSync(`powershell -NoProfile -Command "Expand-Archive -Force -LiteralPath '${ZIP.replace(/\//g, '\\')}' -DestinationPath '${GTFS_DIR.replace(/\//g, '\\')}'"`, { stdio: 'inherit' })
  }
}

/** CSV sederhana dengan dukungan quoted field. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  const [header, ...body] = rows
  const idx = {}
  header.forEach((h, i) => { idx[h.trim()] = i })
  return body.map(r => {
    const o = {}
    for (const k in idx) o[k] = r[idx[k]] ?? ''
    return o
  })
}

function readTable(name) {
  return parseCsv(readFileSync(join(GTFS_DIR, `${name}.txt`), 'utf8'))
}

const R_EARTH = 6371000
function distM(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH * Math.asin(Math.sqrt(a))
}

/** Turunkan jumlah titik shape: simpan titik dengan jarak >= minM dari titik terakhir disimpan. */
function downsample(points, minM = 15) {
  if (points.length <= 2) return points
  const out = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1]
    if (distM(last[0], last[1], points[i][0], points[i][1]) >= minM) out.push(points[i])
  }
  out.push(points[points.length - 1])
  return out
}

/* ---------- pipeline ---------- */

ensureData()

console.log('📄 baca GTFS …')
const routes = readTable('routes')
const stops = readTable('stops')
const trips = readTable('trips')
const stopTimes = readTable('stop_times')
const shapes = readTable('shapes')
const frequencies = readTable('frequencies')
console.log(`   ${routes.length} rute, ${stops.length} stops, ${trips.length} trips, ${stopTimes.length} stop_times, ${shapes.length} shape pts`)

function classify(desc) {
  if (desc.includes('Mikrotrans')) return 'MIKRO'
  if (desc.includes('BRT')) return 'BRT'
  if (desc.includes('Royaltrans')) return 'ROYAL'
  if (desc.includes('Transjabodetabek')) return 'TRANSJABO'
  if (desc.includes('Rusun')) return 'RUSUN'
  if (desc.includes('Bus Wisata')) return 'WISATA'
  return 'LAIN'
}

/* --- SQLite --- */
console.log('🗄  tulis SQLite …')
rmSync(DB_PATH, { force: true })
const db = new DatabaseSync(DB_PATH)
db.exec(`
  CREATE TABLE routes (route_id TEXT PRIMARY KEY, short_name TEXT, long_name TEXT, class TEXT, color TEXT, text_color TEXT);
  CREATE TABLE stops (stop_id TEXT PRIMARY KEY, name TEXT, lat REAL, lon REAL, parent_station TEXT, location_type INTEGER);
  CREATE TABLE trips (trip_id TEXT PRIMARY KEY, route_id TEXT, direction_id INTEGER, shape_id TEXT);
  CREATE TABLE stop_times (trip_id TEXT, stop_sequence INTEGER, stop_id TEXT);
  CREATE TABLE shapes (shape_id TEXT, seq INTEGER, lat REAL, lon REAL);
  CREATE TABLE stop_routes (stop_id TEXT, route_id TEXT);
  CREATE INDEX idx_trips_route ON trips(route_id);
  CREATE INDEX idx_st_trip ON stop_times(trip_id);
  CREATE INDEX idx_sh_shape ON shapes(shape_id);
  CREATE INDEX idx_sr_stop ON stop_routes(stop_id);
`)

const insRoute = db.prepare('INSERT INTO routes VALUES (?,?,?,?,?,?)')
const insStop = db.prepare('INSERT INTO stops VALUES (?,?,?,?,?,?)')
const insTrip = db.prepare('INSERT INTO trips VALUES (?,?,?,?)')
const insST = db.prepare('INSERT INTO stop_times VALUES (?,?,?)')
const insShape = db.prepare('INSERT INTO shapes VALUES (?,?,?,?)')

db.exec('BEGIN')
for (const r of routes) {
  insRoute.run(r.route_id, r.route_short_name, r.route_long_name, classify(r.route_desc),
    `#${(r.route_color || '20242B').toLowerCase()}`, `#${(r.route_text_color || 'FFFFFF').toLowerCase()}`)
}
for (const s of stops) {
  insStop.run(s.stop_id, s.stop_name, +s.stop_lat, +s.stop_lon, s.parent_station || null, +s.location_type || 0)
}
for (const t of trips) insTrip.run(t.trip_id, t.route_id, +t.direction_id || 0, t.shape_id || null)
for (const st of stopTimes) insST.run(st.trip_id, +st.stop_sequence, st.stop_id)
for (const sh of shapes) insShape.run(sh.shape_id, +sh.shape_pt_sequence, +sh.shape_pt_lat, +sh.shape_pt_lon)
db.exec('COMMIT')

/* --- jaringan peta: BRT + MIKRO --- */
console.log('🗺  bangun network.json (BRT + Mikrotrans) …')
const routeById = new Map(routes.map(r => [r.route_id, r]))

// shape_id -> urutan titik
const shapePts = new Map()
for (const sh of shapes) {
  if (!shapePts.has(sh.shape_id)) shapePts.set(sh.shape_id, [])
  shapePts.get(sh.shape_id).push([+sh.shape_pt_lat, +sh.shape_pt_lon, +sh.shape_pt_sequence])
}

// route_id -> Set(shape_id) dari trips
const routeShapes = new Map()
for (const t of trips) {
  if (!t.shape_id) continue
  if (!routeShapes.has(t.route_id)) routeShapes.set(t.route_id, new Set())
  routeShapes.get(t.route_id).add(t.shape_id)
}

const netRoutes = []
for (const [rid, shapeSet] of routeShapes) {
  const r = routeById.get(rid)
  if (!r) continue
  const cls = classify(r.route_desc)
  if (cls !== 'BRT' && cls !== 'MIKRO') continue
  const lines = []
  for (const sid of shapeSet) {
    const pts = (shapePts.get(sid) || []).sort((a, b) => a[2] - b[2]).map(p => [p[0], p[1]])
    if (pts.length > 1) lines.push(downsample(pts))
  }
  if (!lines.length) continue
  netRoutes.push({
    id: rid,
    name: r.route_short_name || rid,
    longName: r.route_long_name,
    class: cls,
    color: `#${(r.route_color || 'e4572e').toLowerCase()}`,
    lines,
  })
}

// stop -> rute yang melayani (via trips + stop_times)
const tripRoute = new Map(trips.map(t => [t.trip_id, t.route_id]))
const stopRoutes = new Map()
for (const st of stopTimes) {
  const rid = tripRoute.get(st.trip_id)
  if (!rid) continue
  const r = routeById.get(rid)
  if (!r) continue
  const cls = classify(r.route_desc)
  if (cls !== 'BRT' && cls !== 'MIKRO') continue
  if (!stopRoutes.has(st.stop_id)) stopRoutes.set(st.stop_id, new Set())
  stopRoutes.get(st.stop_id).add(rid)
}

const stopById = new Map(stops.map(s => [s.stop_id, s]))
const netStops = []
for (const [sid, rset] of stopRoutes) {
  const s = stopById.get(sid)
  if (!s) continue
  const routeList = [...rset].map(rid => {
    const r = routeById.get(rid)
    return { name: r.route_short_name, color: `#${(r.route_color || 'e4572e').toLowerCase()}`, brt: classify(r.route_desc) === 'BRT' }
  }).sort((a, b) => (a.brt === b.brt ? a.name.localeCompare(b.name) : a.brt ? -1 : 1))
  netStops.push({
    id: sid,
    name: s.stop_name,
    lat: +s.stop_lat,
    lon: +s.stop_lon,
    routes: routeList,
  })
}

const network = {
  generatedAt: new Date().toISOString(),
  counts: {
    routes: netRoutes.length,
    brtRoutes: netRoutes.filter(r => r.class === 'BRT').length,
    mikroRoutes: netRoutes.filter(r => r.class === 'MIKRO').length,
    stops: netStops.length,
    linePoints: netRoutes.reduce((a, r) => a + r.lines.reduce((b, l) => b + l.length, 0), 0),
  },
  routes: netRoutes,
  stops: netStops,
}

mkdirSync(join(ROOT, 'public'), { recursive: true })
writeFileSync(OUT_JSON, JSON.stringify(network))
console.log(`✅ ${OUT_JSON}`)
console.log(`   ${netRoutes.length} rute peta, ${netStops.length} halte, ${network.counts.linePoints} titik garis`)

/* --- graph trip planner: pola urutan halte per rute (BRT + MIKRO) --- */
console.log('🧭 bangun planner.json …')

// headway per trip dari frequencies.txt (detik)
const tripHeadway = new Map()
for (const f of frequencies) {
  const secs = +f.headway_secs
  if (secs > 0) tripHeadway.set(f.trip_id, Math.min(secs, 1800))
}

// urutan halte per trip
const stByTrip = new Map()
for (const st of stopTimes) {
  if (!stByTrip.has(st.trip_id)) stByTrip.set(st.trip_id, [])
  stByTrip.get(st.trip_id).push([+st.stop_sequence, st.stop_id])
}

// planner pakai stops idem network.json (sudah difilter BRT+MIKRO)
const plannerStopIdx = new Map(netStops.map((s, i) => [s.id, i]))

// pola unik per rute
const patternsByRoute = new Map()
for (const [tripId, seqRaw] of stByTrip) {
  const rid = tripRoute.get(tripId)
  if (!rid) continue
  const r = routeById.get(rid)
  if (!r) continue
  const cls = classify(r.route_desc)
  if (cls !== 'BRT' && cls !== 'MIKRO') continue
  const seq = seqRaw.sort((a, b) => a[0] - b[0]).map(x => x[1])
  if (seq.length < 2) continue
  // kunci pola: hanya halte yang masuk planner (beberapa stop non-jaringan dilewati)
  const idxSeq = seq.map(sid => plannerStopIdx.get(sid)).filter(x => x !== undefined)
  if (idxSeq.length < 2) continue
  if (!patternsByRoute.has(rid)) patternsByRoute.set(rid, new Map())
  const pm = patternsByRoute.get(rid)
  const key = idxSeq.join(',')
  const hw = tripHeadway.get(tripId)
  if (!pm.has(key)) pm.set(key, { stops: idxSeq, headway: hw })
  else if (hw && (!pm.get(key).headway || hw < pm.get(key).headway)) pm.get(key).headway = hw
}

const plannerRoutes = []
for (const [rid, pm] of patternsByRoute) {
  const r = routeById.get(rid)
  const cls = classify(r.route_desc)
  const pats = [...pm.values()].map(p => ({
    stops: p.stops,
    ...(p.headway ? { hw: Math.round(p.headway / 60) } : {}),
  }))
  plannerRoutes.push({
    id: rid,
    name: r.route_short_name || rid,
    color: `#${(r.route_color || 'e4572e').toLowerCase()}`,
    brt: cls === 'BRT',
    patterns: pats,
  })
}

const planner = {
  generatedAt: new Date().toISOString(),
  stops: netStops.map(s => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon })),
  routes: plannerRoutes,
}
writeFileSync(OUT_PLANNER, JSON.stringify(planner))
const patTotal = plannerRoutes.reduce((a, r) => a + r.patterns.length, 0)
console.log(`✅ ${OUT_PLANNER}`)
console.log(`   ${plannerRoutes.length} rute, ${patTotal} pola, ${planner.stops.length} halte`)
console.log(`✅ ${DB_PATH}`)
