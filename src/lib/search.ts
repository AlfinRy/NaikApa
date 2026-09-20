/* Util pencarian bersama: halte (lokal) + tempat (Nominatim).
   Dipakai SearchBox peta dan input rencana perjalanan. */

export type StopLite = {
  id: string
  name: string
  lat: number
  lon: number
  routes: { name: string; color: string; brt: boolean }[]
}

export type Place = {
  name: string
  detail: string
  lat: number
  lon: number
}

/** Normalisasi nama Indonesia: lowercase, buang diakritik & tanda baca. */
export function fold(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreStop(name: string, q: string, routeCount: number) {
  if (name === q) return 100
  if (name.startsWith(q)) return 60
  const words = name.split(' ')
  if (words.some(w => w.startsWith(q))) return 40
  if (name.includes(q)) return 20
  if (q.length >= 4) {
    const span = subsequenceSpan(q, name)
    if (span > 0) return 8 * (q.length / span)
  }
  return -1
}

/** Jika semua huruf q muncul berurutan di name, kembalikan rentang match
    (rapat = skor tinggi); 0 jika bukan subsequence. */
function subsequenceSpan(q: string, name: string) {
  let i = 0
  let first = -1
  let last = -1
  for (let p = 0; p < name.length && i < q.length; p++) {
    if (name[p] === q[i]) {
      if (first === -1) first = p
      last = p
      i++
    }
  }
  if (i < q.length) return 0
  return last - first + 1
}

export function searchStops(stops: StopLite[], query: string, limit = 7) {
  const q = fold(query)
  if (!q) return []
  const out: { stop: StopLite; score: number }[] = []
  for (const stop of stops) {
    const n = fold(stop.name)
    const score = scoreStop(n, q, stop.routes.length)
    if (score >= 0) out.push({ stop, score: score + Math.min(stop.routes.length, 8) })
  }
  out.sort((a, b) => b.score - a.score || a.stop.name.length - b.stop.name.length)
  return out.slice(0, limit).map(r => r.stop)
}

/** Cari tempat via Nominatim (Jabodetabek bounded). Panggil dengan debounce >= 600ms. */
export async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'id',
    bounded: '1',
    'accept-language': 'id',
    viewbox: '106.26,-5.95,107.05,-6.65',
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { display_name: string; lat: string; lon: string }[]
  return json.map(r => {
    const parts = r.display_name.split(',').map(s => s.trim())
    return {
      name: parts[0],
      detail: parts.slice(1, 4).join(', '),
      lat: Number(r.lat),
      lon: Number(r.lon),
    }
  })
}
