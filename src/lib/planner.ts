/* Trip planner NaikApa — Dijkstra atas (halte) dengan state rute aktif.
   Estimasi waktu: naik = jarak pola / kecepatan rute; tunggu = headway/2;
   jalan kaki = 75 m/menit. Input fleksibel: halte langsung atau titik tempat
   (akses jalan kaki radius 800 m). */

export type PlannerStop = { id: string; name: string; lat: number; lon: number }

export type PlannerRoute = {
  id: string
  name: string
  color: string
  brt: boolean
  patterns: { stops: number[]; hw?: number }[]
}

export type PlannerData = {
  stops: PlannerStop[]
  routes: PlannerRoute[]
}

export type Endpoint =
  | { kind: 'stop'; stopIdx: number }
  | { kind: 'place'; name: string; lat: number; lon: number }

export type RideStep = {
  kind: 'ride'
  routeIdx: number
  from: number
  to: number
  stopCount: number
  minutes: number
  /** nama halte akhir pola — arah layanan */
  direction: string
}

export type WalkStep = {
  kind: 'walk'
  minutes: number
  meters: number
  fromName: string
  toName: string
}

export type PlanStep = RideStep | WalkStep

export type Itinerary = {
  minutes: number
  walkMeters: number
  boardings: number
  steps: PlanStep[]
  usedRoutes: number[]
}

/* ---------- konstanta model ---------- */

const WALK_M_PER_MIN = 75 // 4,5 km/jam
const ACCESS_RADIUS_M = 800
const TRANSFER_WALK_M = 350
const BRT_MIN_PER_KM = 3 // ~20 km/jam
const MIKRO_MIN_PER_KM = 4.3 // ~14 km/jam
const WAIT_DEFAULT_BRT = 4
const WAIT_DEFAULT_MIKRO = 6

const R_EARTH = 6371000
function distM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH * Math.asin(Math.sqrt(a))
}

/* ---------- index ---------- */

type Board = { routeIdx: number; patIdx: number; pos: number }

type Index = {
  stopRoutes: Board[][]
  cumdist: number[][][] // [routeIdx][patIdx][pos] meter kumulatif
  nearby: { idx: number; m: number }[][] // transfer jalan kaki <= 350 m
  waitMin: number[] // per routeIdx
  minPerKm: number[] // per routeIdx
  grid: Map<string, number[]> // sel geo kasar -> stop idx
  cell: number
}

function buildIndex(data: PlannerData): Index {
  const { stops, routes } = data

  // grid geografis kasar (~0.0055° ≈ 600 m) untuk pencarian tetangga
  const cell = 0.0055
  const grid = new Map<string, number[]>()
  stops.forEach((s, i) => {
    const key = `${Math.floor(s.lat / cell)},${Math.floor(s.lon / cell)}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key)!.push(i)
  })

  // cumdist per pola
  const cumdist: number[][][] = routes.map(r =>
    r.patterns.map(p => {
      const out = [0]
      for (let i = 1; i < p.stops.length; i++) {
        const a = stops[p.stops[i - 1]]
        const b = stops[p.stops[i]]
        out.push(out[i - 1] + distM(a.lat, a.lon, b.lat, b.lon))
      }
      return out
    })
  )

  // board index
  const stopRoutes: Board[][] = stops.map(() => [])
  routes.forEach((r, routeIdx) => {
    r.patterns.forEach((p, patIdx) => {
      for (let pos = 0; pos < p.stops.length; pos++) {
        stopRoutes[p.stops[pos]].push({ routeIdx, patIdx, pos })
      }
    })
  })

  // parameter rute
  const waitMin = routes.map((r, i) => {
    const hws = r.patterns.map(p => p.hw).filter((x): x is number => !!x && x > 0)
    const hw = hws.length ? Math.min(...hws) : r.brt ? WAIT_DEFAULT_BRT * 2 : WAIT_DEFAULT_MIKRO * 2
    return Math.max(2, Math.min(10, hw / 2))
  })
  const minPerKm = routes.map(r => (r.brt ? BRT_MIN_PER_KM : MIKRO_MIN_PER_KM))

  // tetangga transfer (<= 350 m) — pakai grid 3x3
  const nearby: { idx: number; m: number }[][] = stops.map(() => [])
  stops.forEach((s, i) => {
    const cx = Math.floor(s.lat / cell)
    const cy = Math.floor(s.lon / cell)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${cx + dx},${cy + dy}`)
        if (!bucket) continue
        for (const j of bucket) {
          if (j === i) continue
          const m = distM(s.lat, s.lon, stops[j].lat, stops[j].lon)
          if (m <= TRANSFER_WALK_M) nearby[i].push({ idx: j, m })
        }
      }
    }
  })

  return { stopRoutes, cumdist, nearby, waitMin, minPerKm, grid, cell }
}

function stopsNear(idx: Index, stops: PlannerStop[], lat: number, lon: number, radius: number) {
  const cx = Math.floor(lat / idx.cell)
  const cy = Math.floor(lon / idx.cell)
  const span = Math.ceil(radius / 60000 / idx.cell) + 1
  const out: { idx: number; m: number }[] = []
  for (let dx = -span; dx <= span; dx++) {
    for (let dy = -span; dy <= span; dy++) {
      const bucket = idx.grid.get(`${cx + dx},${cy + dy}`)
      if (!bucket) continue
      for (const j of bucket) {
        const m = distM(lat, lon, stops[j].lat, stops[j].lon)
        if (m <= radius) out.push({ idx: j, m })
      }
    }
  }
  return out.sort((a, b) => a.m - b.m)
}

/* ---------- dijkstra ---------- */

type Label = {
  cost: number
  boardings: number
  curRoute: number // -1 = jalan kaki / awal
  prevStop: number
  edge:
    | { t: 'ride'; routeIdx: number; patIdx: number; fromPos: number; toPos: number }
    | { t: 'walk'; fromStop: number; m: number }
    | null
  done: boolean
}

/** Binary heap sederhana atas [cost, boardings, stopIdx]. */
class Heap {
  private a: [number, number, number][] = []
  get size() {
    return this.a.length
  }
  push(v: [number, number, number]) {
    const a = this.a
    a.push(v)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (cmp(a[i], a[p]) < 0) {
        ;[a[i], a[p]] = [a[p], a[i]]
        i = p
      } else break
    }
  }
  pop() {
    const a = this.a
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let s = i
        if (l < a.length && cmp(a[l], a[s]) < 0) s = l
        if (r < a.length && cmp(a[r], a[s]) < 0) s = r
        if (s === i) break
        ;[a[i], a[s]] = [a[s], a[i]]
        i = s
      }
    }
    return top
  }
}
function cmp(a: [number, number, number], b: [number, number, number]) {
  return a[0] - b[0] || a[1] - b[1]
}

function runDijkstra(
  data: PlannerData,
  idx: Index,
  origin: Endpoint,
  dest: Endpoint,
  routePenalty: Map<number, number>,
): Itinerary | null {
  const { stops, routes } = data
  const labels: Label[] = stops.map(() => ({
    cost: Infinity,
    boardings: Infinity,
    curRoute: -1,
    prevStop: -1,
    edge: null,
    done: false,
  }))
  const heap = new Heap()

  // titik awal
  let originName = ''
  const seed = (stopIdx: number, cost: number, m: number, fromName: string) => {
    const L = labels[stopIdx]
    if (cost < L.cost) {
      L.cost = cost
      L.boardings = 0
      L.curRoute = -1
      L.prevStop = -1
      L.edge = m > 0 ? { t: 'walk', fromStop: -1, m } : null
      if (m > 0) walkFromName[stopIdx] = fromName
      heap.push([cost, 0, stopIdx])
    }
  }
  const walkFromName: Record<number, string> = {}

  if (origin.kind === 'stop') {
    seed(origin.stopIdx, 0, 0, '')
    originName = stops[origin.stopIdx].name
  } else {
    originName = origin.name
    const near = stopsNear(idx, stops, origin.lat, origin.lon, ACCESS_RADIUS_M).slice(0, 12)
    for (const n of near) seed(n.idx, n.m / WALK_M_PER_MIN, n.m, originName)
  }

  // target egress
  let destStops: { idx: number; m: number }[] = []
  let destName = ''
  if (dest.kind === 'stop') {
    destName = stops[dest.stopIdx].name
    destStops = [{ idx: dest.stopIdx, m: 0 }]
  } else {
    destName = dest.name
    destStops = stopsNear(idx, stops, dest.lat, dest.lon, ACCESS_RADIUS_M).slice(0, 12)
  }
  const destIdxSet = new Map(destStops.map(d => [d.idx, d.m]))

  let bestTotal = Infinity
  let bestStop = -1

  while (heap.size) {
    const [cost, boardings, u] = heap.pop()
    const L = labels[u]
    if (L.done || cost > L.cost + 1e-9) continue
    L.done = true

    // egress
    const egress = destIdxSet.get(u)
    if (egress !== undefined) {
      const total = cost + egress / WALK_M_PER_MIN
      if (total < bestTotal) {
        bestTotal = total
        bestStop = u
      }
    }

    // naik rute dari sini
    for (const b of idx.stopRoutes[u]) {
      const pen = routePenalty.get(b.routeIdx) ?? 1
      const sameRoute = L.curRoute === b.routeIdx
      const wait = sameRoute ? 0 : idx.waitMin[b.routeIdx]
      const pat = routes[b.routeIdx].patterns[b.patIdx]
      const cd = idx.cumdist[b.routeIdx][b.patIdx]
      const mpk = idx.minPerKm[b.routeIdx]
      for (let pos = b.pos + 1; pos < pat.stops.length; pos++) {
        const v = pat.stops[pos]
        const Lv = labels[v]
        if (Lv.done) continue
        const rideMin = ((cd[pos] - cd[b.pos]) / 1000) * mpk * pen
        const nc = cost + wait + rideMin
        const nb = boardings + (sameRoute ? 0 : 1)
        if (nc < Lv.cost - 1e-9 || (Math.abs(nc - Lv.cost) < 1e-9 && nb < Lv.boardings)) {
          Lv.cost = nc
          Lv.boardings = nb
          Lv.curRoute = b.routeIdx
          Lv.prevStop = u
          Lv.edge = { t: 'ride', routeIdx: b.routeIdx, patIdx: b.patIdx, fromPos: b.pos, toPos: pos }
          heap.push([nc, nb, v])
        }
      }
    }

    // transfer jalan kaki ke halte dekat
    for (const n of idx.nearby[u]) {
      const v = n.idx
      const Lv = labels[v]
      if (Lv.done) continue
      const nc = cost + n.m / WALK_M_PER_MIN + 1 // +1 mnt pembulatan transfer
      const nb = boardings
      if (nc < Lv.cost - 1e-9) {
        Lv.cost = nc
        Lv.boardings = nb
        Lv.curRoute = -1
        Lv.prevStop = u
        Lv.edge = { t: 'walk', fromStop: u, m: n.m }
        heap.push([nc, nb, v])
      }
    }
  }

  if (bestStop < 0) return null

  // rekonstruksi
  const rawSteps: { u: number; edge: NonNullable<Label['edge']> }[] = []
  let cur = bestStop
  while (labels[cur].edge) {
    rawSteps.push({ u: cur, edge: labels[cur].edge! })
    cur = labels[cur].prevStop
    if (cur < 0) break
  }

  const steps: PlanStep[] = []
  const usedRoutes = new Set<number>()
  let walkMeters = 0

  for (let i = rawSteps.length - 1; i >= 0; i--) {
    const { u, edge } = rawSteps[i]
    if (edge.t === 'ride') {
      const r = routes[edge.routeIdx]
      const pat = r.patterns[edge.patIdx]
      usedRoutes.add(edge.routeIdx)
      const cd = idx.cumdist[edge.routeIdx][edge.patIdx]
      const minutes =
        ((cd[edge.toPos] - cd[edge.fromPos]) / 1000) * idx.minPerKm[edge.routeIdx]
      // gabung dengan ride sebelumnya bila masih rute yang sama (lanjutan naik)
      const last = steps[steps.length - 1]
      if (last && last.kind === 'ride' && last.routeIdx === edge.routeIdx) {
        last.minutes += minutes
        last.stopCount += edge.toPos - edge.fromPos
        last.to = u
      } else {
        steps.push({
          kind: 'ride',
          routeIdx: edge.routeIdx,
          from: pat.stops[edge.fromPos],
          to: u,
          stopCount: edge.toPos - edge.fromPos,
          minutes,
          direction: stops[pat.stops[pat.stops.length - 1]].name,
        })
      }
    } else {
      const to = u
      const toName = stops[to].name
      const fromName = edge.fromStop >= 0 ? stops[edge.fromStop].name : walkFromName[u] || 'titik awal'
      // gabung dengan step jalan sebelumnya bila berurutan
      const last = steps[steps.length - 1]
      if (last && last.kind === 'walk') {
        last.minutes += edge.m / WALK_M_PER_MIN
        last.meters += edge.m
        last.toName = toName
      } else {
        steps.push({
          kind: 'walk',
          minutes: edge.m / WALK_M_PER_MIN,
          meters: edge.m,
          fromName,
          toName,
        })
      }
      walkMeters += edge.m
    }
  }

  // egress jalan ke tujuan (tempat)
  const egressM = destIdxSet.get(bestStop) ?? 0
  if (egressM > 0) {
    const last = steps[steps.length - 1]
    if (last && last.kind === 'walk') {
      last.minutes += egressM / WALK_M_PER_MIN
      last.meters += egressM
      last.toName = destName
    } else {
      steps.push({
        kind: 'walk',
        minutes: egressM / WALK_M_PER_MIN,
        meters: egressM,
        fromName: stops[bestStop].name,
        toName: destName,
      })
    }
    walkMeters += egressM
  }

  const boardings = steps.filter(s => s.kind === 'ride').length
  // waktu tunggu masuk cost tapi tidak di step ride — tambahkan sebagai bagian ride
  // (biar total konsisten, hitung ulang minutes dengan wait)
  let total = steps.reduce((a, s) => a + s.minutes, 0)
  // tambah wait per boarding
  for (const s of steps) {
    if (s.kind === 'ride') {
      const w = idx.waitMin[s.routeIdx]
      s.minutes += w
      total += w
    }
  }

  return {
    minutes: Math.round(total),
    walkMeters: Math.round(walkMeters),
    boardings,
    steps,
    usedRoutes: [...usedRoutes],
  }
}

/** Rencanakan perjalanan. Mengembalikan [terbaik, alternatif] (alternatif bisa null). */
export function planTrip(
  data: PlannerData,
  origin: Endpoint,
  dest: Endpoint,
): { best: Itinerary; alt: Itinerary | null } | null {
  const idx = buildIndex(data)
  const best = runDijkstra(data, idx, origin, dest, new Map())
  if (!best) return null
  // alternatif: penalti rute yang dipakai rute terbaik
  const penalty = new Map<number, number>()
  for (const r of best.usedRoutes) penalty.set(r, 1.6)
  let alt: Itinerary | null = null
  try {
    alt = runDijkstra(data, idx, origin, dest, penalty)
  } catch {
    alt = null
  }
  if (alt && itinKey(alt) === itinKey(best)) alt = null
  return { best, alt }
}

function itinKey(it: Itinerary) {
  return it.steps
    .filter(s => s.kind === 'ride')
    .map(s => (s as RideStep).routeIdx)
    .join('>')
}
