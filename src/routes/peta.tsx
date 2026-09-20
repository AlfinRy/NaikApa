import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Search, Signpost, X } from 'lucide-react'
import type { CircleMarker, LayerGroup, Map as LeafletMap, Polyline } from 'leaflet'
import '../styles/peta.css'
import 'leaflet/dist/leaflet.css'

export const Route = createFileRoute('/peta')({
  component: PetaPage,
})

type NetRoute = {
  id: string
  name: string
  longName: string
  class: 'BRT' | 'MIKRO'
  color: string
  lines: [number, number][][]
}

type NetStop = {
  id: string
  name: string
  lat: number
  lon: number
  routes: { name: string; color: string; brt: boolean }[]
}

type Network = {
  counts: { routes: number; brtRoutes: number; mikroRoutes: number; stops: number }
  routes: NetRoute[]
  stops: NetStop[]
}

type Place = {
  name: string
  detail: string
  lat: number
  lon: number
}

type Selection =
  | { kind: 'stop'; stop: NetStop }
  | { kind: 'place'; place: Place }
  | null

/* ---------- util pencarian ---------- */

/** Normalisasi nama Indonesia: lowercase, buang diakritik & tanda baca. */
function fold(s: string) {
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
    (posisi terakhir - pertama + 1); 0 jika bukan subsequence.
    Match rapat (mis. "monas" -> "MONumen NASional") dapat skor lebih tinggi. */
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

function searchStops(stops: NetStop[], query: string, limit = 7) {
  const q = fold(query)
  if (!q) return []
  const out: { stop: NetStop; score: number }[] = []
  for (const stop of stops) {
    const n = fold(stop.name)
    const score = scoreStop(n, q, stop.routes.length)
    if (score >= 0) out.push({ stop, score: score + Math.min(stop.routes.length, 8) })
  }
  out.sort((a, b) => b.score - a.score || a.stop.name.length - b.stop.name.length)
  return out.slice(0, limit).map(r => r.stop)
}

/* ---------- halaman peta ---------- */

function PetaPage() {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const [network, setNetwork] = useState<Network | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showBrt, setShowBrt] = useState(true)
  const [showMikro, setShowMikro] = useState(true)
  const [selection, setSelection] = useState<Selection>(null)
  const layersRef = useRef<{ brt?: LayerGroup; mikro?: LayerGroup }>({})
  const lineIndexRef = useRef<{ line: Polyline; cls: 'BRT' | 'MIKRO'; color: string; route: string }[]>([])
  const stopIndexRef = useRef<Map<string, CircleMarker>>(new Map())
  const placeMarkerRef = useRef<CircleMarker | null>(null)

  /* muat data jaringan */
  useEffect(() => {
    let alive = true
    fetch('/network.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { if (alive) setNetwork(d) })
      .catch(() => {
        if (alive) setError('Data jaringan belum tersedia. Jalankan: node scripts/etl-gtfs.mjs')
      })
    return () => { alive = false }
  }, [])

  /* init peta (client-only) */
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    let cancelled = false
    import('leaflet').then(async L => {
      if (cancelled || !mapEl.current) return
      const map = L.map(mapEl.current, {
        preferCanvas: true,
        center: [-6.2, 106.845],
        zoom: 12,
      })
      map.zoomControl.setPosition('bottomright')
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap &middot; data: GTFS TransJakarta',
      }).addTo(map)
      mapRef.current = map
      window.dispatchEvent(new Event('resize'))
    })
    return () => { cancelled = true }
  }, [])

  /* render layer dari data */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !network) return
    let cancelled = false

    import('leaflet').then(L => {
      if (cancelled || !mapEl.current) return

      // bersihkan layer lama
      Object.values(layersRef.current).forEach(g => g?.remove())
      layersRef.current = {}
      lineIndexRef.current = []
      stopIndexRef.current = new Map()

      const mkGroup = (cls: 'BRT' | 'MIKRO') => {
        const group = L.layerGroup()

        const routes = network.routes.filter(r => r.class === cls)
        for (const r of routes) {
          for (const line of r.lines) {
            const poly = L.polyline(line, {
              color: r.color,
              weight: cls === 'BRT' ? 3.5 : 1.8,
              opacity: cls === 'BRT' ? 0.9 : 0.7,
              lineCap: 'round',
            }).addTo(group)
            lineIndexRef.current.push({ line: poly, cls, color: r.color, route: r.name })
          }
        }

        for (const s of network.stops) {
          const isBrtStop = s.routes.some(r => r.brt)
          if (cls === 'BRT' && !isBrtStop) continue
          if (cls === 'MIKRO' && isBrtStop) continue
          const marker = L.circleMarker([s.lat, s.lon], {
            radius: isBrtStop ? 4 : 2,
            color: '#20242b',
            weight: 1.2,
            fillColor: isBrtStop ? '#f6f3ea' : s.routes[0]?.color || '#7c5cbf',
            fillOpacity: isBrtStop ? 1 : 0.8,
          })
            .bindPopup(popupHtml(s))
            .addTo(group)
          stopIndexRef.current.set(s.id, marker)
        }

        return group
      }

      layersRef.current.brt = mkGroup('BRT')
      layersRef.current.mikro = mkGroup('MIKRO')
      if (showBrt) layersRef.current.brt.addTo(map)
      if (showMikro) layersRef.current.mikro.addTo(map)

      // hook dev untuk diagnosa (diuji lewat scripts/diag-*.mjs)
      if (import.meta.env.DEV) {
        ;(window as unknown as Record<string, unknown>).__naikapa = {
          lines: lineIndexRef.current,
          stops: stopIndexRef.current,
        }
      }
    })

    return () => { cancelled = true }
  }, [network])

  /* toggle layer */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !network) return
    const { brt, mikro } = layersRef.current
    if (!brt || !mikro) return
    if (showBrt && !map.hasLayer(brt)) brt.addTo(map)
    if (!showBrt && map.hasLayer(brt)) map.removeLayer(brt)
    if (showMikro && !map.hasLayer(mikro)) mikro.addTo(map)
    if (!showMikro && map.hasLayer(mikro)) map.removeLayer(mikro)
  }, [showBrt, showMikro, network])

  /* highlight rute + terbang ke pilihan */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !network) return

    // reset gaya polyline ke semula
    for (const { line, cls } of lineIndexRef.current) {
      line.setStyle({
        weight: cls === 'BRT' ? 3.5 : 1.8,
        opacity: cls === 'BRT' ? 0.9 : 0.7,
      })
    }

    // hapus penanda tempat lama
    placeMarkerRef.current?.remove()
    placeMarkerRef.current = null

    if (!selection) return

    if (selection.kind === 'stop') {
      const { stop } = selection
      const active = new Set(stop.routes.map(r => r.name))
      for (const entry of lineIndexRef.current) {
        if (active.has(entry.route)) {
          entry.line.setStyle({
            weight: entry.cls === 'BRT' ? 6.5 : 4,
            opacity: 1,
          })
          entry.line.bringToFront()
        } else {
          entry.line.setStyle({ opacity: 0.12 })
        }
      }
      map.flyTo([stop.lat, stop.lon], 16, { duration: 0.8 })
      const marker = stopIndexRef.current.get(stop.id)
      setTimeout(() => marker?.openPopup(), 850)
    } else {
      const { place } = selection
      import('leaflet').then(L => {
        placeMarkerRef.current = L.circleMarker([place.lat, place.lon], {
          radius: 8,
          color: '#20242b',
          weight: 2.5,
          fillColor: '#e4572e',
          fillOpacity: 1,
        })
          .bindPopup(
            `<div class="peta-popup"><p class="popup-name">${escapeHtml(place.name)}</p>` +
            `<p style="margin:0;font-size:.78rem;color:var(--ink-soft)">${escapeHtml(place.detail)}</p></div>`
          )
          .addTo(map)
          .openPopup()
      })
      map.flyTo([place.lat, place.lon], 15, { duration: 0.8 })
    }
  }, [selection, network])

  return (
    <div className="peta-page">
      <div className="peta-topbar">
        <a href="/" className="wordmark" aria-label="NaikApa — kembali ke beranda">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22V2" />
            <path d="m8 6 4-4 4 4" />
            <path d="m4 14 4-4 4 4" />
            <path d="m12 14 4-4 4 4" />
          </svg>
          NaikApa
        </a>
        <span className="spacer" />
        {network && (
          <span style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
            {network.counts.brtRoutes} koridor BRT &middot; {network.counts.mikroRoutes} Mikrotrans
          </span>
        )}
        <a className="peta-link" href="/">Beranda</a>
      </div>

      <div className="peta-main">
        <div className="peta-map" ref={mapEl} />

        {network && (
          <SearchBox
            network={network}
            onSelect={setSelection}
            onClear={() => setSelection(null)}
          />
        )}

        {network && (
          <div className="peta-panel">
            <div className="peta-card">
              <h2>Lapisan</h2>
              <label className="peta-toggle">
                <input
                  type="checkbox"
                  checked={showBrt}
                  onChange={e => setShowBrt(e.target.checked)}
                />
                <span className="swatch" style={{ background: 'var(--vermilion)' }} aria-hidden="true" />
                Koridor BRT
              </label>
              <label className="peta-toggle">
                <input
                  type="checkbox"
                  checked={showMikro}
                  onChange={e => setShowMikro(e.target.checked)}
                />
                <span className="swatch" style={{ background: 'var(--violet)' }} aria-hidden="true" />
                Mikrotrans
              </label>
            </div>
          </div>
        )}

        {!network && !error && (
          <div className="peta-loading">
            <span>Memuat jaringan rute&hellip;</span>
          </div>
        )}

        {error && (
          <div className="peta-loading" role="alert">
            <span>{error}</span>
          </div>
        )}

        <span className="peta-credit">
          NaikApa &mdash; proyek independen, data GTFS resmi TransJakarta
        </span>
      </div>
    </div>
  )
}

/* ---------- kotak pencarian ---------- */

function SearchBox({
  network,
  onSelect,
  onClear,
}: {
  network: Network
  onSelect: (s: Selection) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [places, setPlaces] = useState<Place[]>([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [placesError, setPlacesError] = useState(false)

  const stopHits = useMemo(() => searchStops(network.stops, query), [network, query])

  /* Nominatim — debounce 600ms, minimal 3 huruf */
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setPlaces([])
      setPlacesLoading(false)
      setPlacesError(false)
      return
    }
    const controller = new AbortController()
    setPlacesLoading(true)
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q,
          format: 'jsonv2',
          limit: '5',
          countrycodes: 'id',
          bounded: '1',
          'accept-language': 'id',
          viewbox: '106.26,-5.95,107.05,-6.65',
        })
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as { display_name: string; lat: string; lon: string }[]
        const mapped = json.map(r => {
          const parts = r.display_name.split(',').map(s => s.trim())
          return {
            name: parts[0],
            detail: parts.slice(1, 4).join(', '),
            lat: Number(r.lat),
            lon: Number(r.lon),
          }
        })
        setPlaces(mapped)
        setPlacesError(false)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setPlacesError(true)
      } finally {
        setPlacesLoading(false)
      }
    }, 600)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [query])

  const total = stopHits.length + places.length
  const showDropdown = open && query.trim().length > 0

  function chooseStop(stop: NetStop) {
    setQuery(stop.name)
    setOpen(false)
    setActive(0)
    onSelect({ kind: 'stop', stop })
  }

  function choosePlace(place: Place) {
    setQuery(place.name)
    setOpen(false)
    setActive(0)
    onSelect({ kind: 'place', place })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(a => Math.min(a + 1, total - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(a => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (active < stopHits.length) chooseStop(stopHits[active])
      else {
        const p = places[active - stopHits.length]
        if (p) choosePlace(p)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="peta-search">
      <div className="search-field">
        <Search size={17} strokeWidth={2.4} aria-hidden="true" />
        <input
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-results"
          aria-autocomplete="list"
          aria-label="Cari nama tempat atau nama halte"
          placeholder="Cari tempat atau halte…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setTimeout(() => setOpen(false), 150)
          }}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            aria-label="Bersihkan pencarian"
            onClick={() => {
              setQuery('')
              setOpen(false)
              onClear()
            }}
          >
            <X size={15} strokeWidth={2.6} aria-hidden="true" />
          </button>
        )}
      </div>

      {showDropdown && (
        <ul className="search-results" id="search-results" role="listbox" aria-label="Hasil pencarian">
          {stopHits.map((stop, i) => (
            <li key={stop.id} role="option" aria-selected={active === i}>
              <button
                type="button"
                className="result stop"
                onMouseEnter={() => setActive(i)}
                onClick={() => chooseStop(stop)}
              >
                <MapPin size={16} strokeWidth={2.2} aria-hidden="true" />
                <span className="result-body">
                  <span className="result-name">{stop.name}</span>
                  <span className="result-chips">
                    {stop.routes.slice(0, 4).map(r => (
                      <span key={r.name} className="chip" style={{ background: r.color }}>
                        {r.name}
                      </span>
                    ))}
                    {stop.routes.length > 4 && <span className="more">+{stop.routes.length - 4}</span>}
                  </span>
                </span>
                <span className="result-kind">halte</span>
              </button>
            </li>
          ))}

          {placesLoading && (
            <li className="result-note" aria-live="polite">
              <span className="result-name">Mencari tempat&hellip;</span>
            </li>
          )}
          {placesError && (
            <li className="result-note">
              <span className="result-name">Pencarian tempat gagal &mdash; coba lagi.</span>
            </li>
          )}

          {places.map((place, i) => {
            const idx = stopHits.length + i
            return (
              <li key={`${place.lat},${place.lon}`} role="option" aria-selected={active === idx}>
                <button
                  type="button"
                  className="result place"
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => choosePlace(place)}
                >
                  <Signpost size={16} strokeWidth={2.2} aria-hidden="true" />
                  <span className="result-body">
                    <span className="result-name">{place.name}</span>
                    <span className="result-detail">{place.detail}</span>
                  </span>
                  <span className="result-kind">tempat</span>
                </button>
              </li>
            )
          })}

          {!placesLoading && query.trim().length >= 3 && total === 0 && !placesError && (
            <li className="result-note">
              <span className="result-name">Tidak ada hasil untuk &ldquo;{query.trim()}&rdquo;.</span>
            </li>
          )}
          {query.trim().length > 0 && query.trim().length < 3 && stopHits.length === 0 && (
            <li className="result-note">
              <span className="result-name">Ketik minimal 3 huruf untuk mencari tempat.</span>
            </li>
          )}

          {places.length > 0 && (
            <li className="search-attribution">
              Tempat oleh Nominatim &copy; OpenStreetMap
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function popupHtml(s: NetStop) {
  const chips = s.routes
    .slice(0, 12)
    .map(r => `<span class="chip" style="background:${r.color}">${r.name}</span>`)
    .join('')
  const more = s.routes.length > 12 ? `<span style="font-size:.72rem;color:var(--ink-soft)">+${s.routes.length - 12} lainnya</span>` : ''
  return `<div class="peta-popup"><p class="popup-name"></p><div class="route-chips">${chips}${more}</div></div>`
    .replace('<p class="popup-name"></p>', `<p class="popup-name">${escapeHtml(s.name)}</p>`)
}

function escapeHtml(t: string) {
  return t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
