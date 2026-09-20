import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Route as RouteIcon, Search, Signpost, X } from 'lucide-react'
import type { CircleMarker, LayerGroup, Map as LeafletMap, Polyline } from 'leaflet'
import { searchPlaces, searchStops, type Place, type StopLite } from '../lib/search'
import { planTrip, type Endpoint, type Itinerary, type PlannerData } from '../lib/planner'
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

type Network = {
  counts: { routes: number; brtRoutes: number; mikroRoutes: number; stops: number }
  routes: NetRoute[]
  stops: (StopLite & { lat: number; lon: number })[]
}

type Sel =
  | { kind: 'stop'; stopId: string; name: string; lat: number; lon: number }
  | { kind: 'place'; name: string; detail: string; lat: number; lon: number }

type Selection = Sel | null

/* ---------- halaman peta ---------- */

function PetaPage() {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const [network, setNetwork] = useState<Network | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showBrt, setShowBrt] = useState(true)
  const [showMikro, setShowMikro] = useState(true)
  const [selection, setSelection] = useState<Selection>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [planOrigin, setPlanOrigin] = useState<Selection>(null)
  const [planDest, setPlanDest] = useState<Selection>(null)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [planner, setPlanner] = useState<PlannerData | null>(null)
  const [plannerLoading, setPlannerLoading] = useState(false)
  const layersRef = useRef<{ brt?: LayerGroup; mikro?: LayerGroup }>({})
  const lineIndexRef = useRef<{ line: Polyline; cls: 'BRT' | 'MIKRO'; color: string; route: string }[]>([])
  const stopIndexRef = useRef<Map<string, CircleMarker>>(new Map())
  const placeMarkerRef = useRef<CircleMarker | null>(null)
  const planMarkersRef = useRef<CircleMarker[]>([])

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
            .bindPopup(popupHtml(s.name, s.routes))
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

  /* highlight rute + terbang ke pilihan pencarian */
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
      const { stopId, name, lat, lon } = selection
      const routeNames = new Set(
        network.stops.find(s => s.id === stopId)?.routes.map(r => r.name) ?? []
      )
      applyHighlight(routeNames)
      map.flyTo([lat, lon], 16, { duration: 0.8 })
      const marker = stopIndexRef.current.get(stopId)
      setTimeout(() => marker?.openPopup(), 850)
      void name
    } else {
      const { name, detail, lat, lon } = selection
      import('leaflet').then(L => {
        placeMarkerRef.current = L.circleMarker([lat, lon], {
          radius: 8,
          color: '#20242b',
          weight: 2.5,
          fillColor: '#e4572e',
          fillOpacity: 1,
        })
          .bindPopup(
            `<div class="peta-popup"><p class="popup-name">${escapeHtml(name)}</p>` +
            `<p style="margin:0;font-size:.78rem;color:var(--ink-soft)">${escapeHtml(detail)}</p></div>`
          )
          .addTo(map)
          .openPopup()
      })
      map.flyTo([lat, lon], 15, { duration: 0.8 })
    }
  }, [selection, network])

  function applyHighlight(routeNames: Set<string>) {
    for (const entry of lineIndexRef.current) {
      if (routeNames.has(entry.route)) {
        entry.line.setStyle({
          weight: entry.cls === 'BRT' ? 6.5 : 4,
          opacity: 1,
        })
        entry.line.bringToFront()
      } else {
        entry.line.setStyle({ opacity: 0.12 })
      }
    }
  }

  /* jalankan rencana perjalanan bila asal & tujuan lengkap */
  useEffect(() => {
    setItinerary(null)
    if (!planOrigin || !planDest || !planner) return

    const stopIdxById = new Map(planner.stops.map((s, i) => [s.id, i]))
    const toEndpoint = (sel: Selection): Endpoint | null => {
      if (!sel) return null
      if (sel.kind === 'stop') {
        const idx = stopIdxById.get(sel.stopId)
        return idx === undefined ? null : { kind: 'stop', stopIdx: idx }
      }
      return { kind: 'place', name: sel.name, lat: sel.lat, lon: sel.lon }
    }
    const o = toEndpoint(planOrigin)
    const d = toEndpoint(planDest)
    if (o === null || d === null) return

    const t0 = performance.now()
    const res = planTrip(planner, o, d)
    const ms = Math.round(performance.now() - t0)
    console.info(`[naikapa] rencana dihitung ${ms} ms`)
    if (res) setItinerary(res.best)
  }, [planOrigin, planDest, planner])

  /* render itinerary ke peta: highlight rute + marker O/D + fitBounds */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !network || !planner) return

    planMarkersRef.current.forEach(m => m.remove())
    planMarkersRef.current = []

    if (!itinerary || !planOpen) return

    const routeNames = new Set(
      itinerary.steps
        .filter((s): s is Extract<typeof s, { kind: 'ride' }> => s.kind === 'ride')
        .map(s => planner.routes[s.routeIdx].name)
    )
    applyHighlight(routeNames)

    import('leaflet').then(L => {
      const pts: [number, number][] = []

      const addMark = (lat: number, lon: number, label: string, vermilion: boolean) => {
        const m = L.circleMarker([lat, lon], {
          radius: 7,
          color: '#20242b',
          weight: 2.5,
          fillColor: vermilion ? '#e4572e' : '#2f9e63',
          fillOpacity: 1,
        })
          .bindPopup(`<div class="peta-popup"><p class="popup-name">${escapeHtml(label)}</p></div>`)
          .addTo(map)
        planMarkersRef.current.push(m)
        pts.push([lat, lon])
      }

      for (const step of itinerary.steps) {
        if (step.kind === 'ride') {
          addMark(planner.stops[step.from].lat, planner.stops[step.from].lon, planner.stops[step.from].name, true)
          pts.push([planner.stops[step.to].lat, planner.stops[step.to].lon])
        }
      }
      if (planOrigin) addMark(planOrigin.lat, planOrigin.lon, planOrigin.name, false)
      if (planDest) addMark(planDest.lat, planDest.lon, planDest.name, false)

      if (pts.length > 1) {
        map.flyToBounds(L.latLngBounds(pts).pad(0.25), { duration: 0.8 })
      }
    })
  }, [itinerary, planOpen, network, planner])

  /* muat planner.json saat panel dibuka pertama kali */
  function openPlan() {
    setPlanOpen(true)
    if (!planner && !plannerLoading) {
      setPlannerLoading(true)
      fetch('/planner.json')
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then(d => setPlanner(d))
        .catch(() => setError('Gagal memuat data perencana.'))
        .finally(() => setPlannerLoading(false))
    }
  }

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
          <LocationInput
            stops={network.stops}
            placeholder="Cari tempat atau halte…"
            ariaLabel="Cari nama tempat atau nama halte"
            onSelect={setSelection}
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

        {/* tombol buka perencana */}
        {network && !planOpen && (
          <button type="button" className="plan-fab" onClick={openPlan}>
            <RouteIcon size={17} strokeWidth={2.4} aria-hidden="true" />
            Rute
          </button>
        )}

        {/* panel perencana perjalanan */}
        {planOpen && network && (
          <PlanPanel
            stops={network.stops}
            planner={planner}
            loading={plannerLoading}
            origin={planOrigin}
            dest={planDest}
            itinerary={itinerary}
            onOrigin={setPlanOrigin}
            onDest={setPlanDest}
            onClose={() => {
              setPlanOpen(false)
              setItinerary(null)
            }}
          />
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

/* ---------- input lokasi reusable (peta & perencana) ---------- */

function LocationInput({
  stops,
  placeholder,
  ariaLabel,
  onSelect,
}: {
  stops: StopLite[]
  placeholder: string
  ariaLabel: string
  onSelect: (sel: Selection) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [places, setPlaces] = useState<Place[]>([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [placesError, setPlacesError] = useState(false)

  const stopHits = useMemo(() => searchStops(stops, query), [stops, query])

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
        const res = await searchPlaces(q, controller.signal)
        setPlaces(res)
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

  function chooseStop(stop: StopLite) {
    setQuery(stop.name)
    setOpen(false)
    setActive(0)
    onSelect({ kind: 'stop', stopId: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon })
  }

  function choosePlace(place: Place) {
    setQuery(place.name)
    setOpen(false)
    setActive(0)
    onSelect({ kind: 'place', name: place.name, detail: place.detail, lat: place.lat, lon: place.lon })
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
          aria-label={ariaLabel}
          placeholder={placeholder}
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

/* ---------- panel rencana perjalanan ---------- */

function PlanPanel({
  stops,
  planner,
  loading,
  origin,
  dest,
  itinerary,
  onOrigin,
  onDest,
  onClose,
}: {
  stops: StopLite[]
  planner: PlannerData | null
  loading: boolean
  origin: Selection
  dest: Selection
  itinerary: Itinerary | null
  onOrigin: (s: Selection) => void
  onDest: (s: Selection) => void
  onClose: () => void
}) {
  return (
    <aside className="plan-panel" aria-label="Rencana perjalanan">
      <div className="plan-head">
        <h2>Rencana perjalanan</h2>
        <button type="button" className="plan-close" aria-label="Tutup rencana perjalanan" onClick={onClose}>
          <X size={16} strokeWidth={2.6} aria-hidden="true" />
        </button>
      </div>

      <div className="plan-inputs">
        <div className="plan-input-row">
          <span className="plan-dot from" aria-hidden="true" />
          <LocationInput
            stops={stops}
            placeholder="Dari — halte atau tempat"
            ariaLabel="Titik keberangkatan"
            onSelect={onOrigin}
          />
        </div>
        <div className="plan-input-row">
          <span className="plan-dot to" aria-hidden="true" />
          <LocationInput
            stops={stops}
            placeholder="Ke — halte atau tempat"
            ariaLabel="Titik tujuan"
            onSelect={onDest}
          />
        </div>
      </div>

      {loading && <p className="plan-note">Memuat data perencana&hellip;</p>}

      {!loading && origin && dest && !itinerary && (
        <p className="plan-note">Tidak ditemukan rute pada jaringan BRT &amp; Mikrotrans.</p>
      )}

      {!loading && (!origin || !dest) && (
        <p className="plan-note">Pilih titik keberangkatan dan tujuan — estimasi waktu, bukan jadwal.</p>
      )}

      {itinerary && planner && (
        <div className="plan-result" aria-live="polite">
          <div className="plan-summary">
            <strong>± {itinerary.minutes} menit</strong>
            <span>{itinerary.boardings} kali naik</span>
            {itinerary.walkMeters > 0 && (
              <span>jalan ± {formatMeters(itinerary.walkMeters)}</span>
            )}
          </div>
          <ol className="plan-steps">
            {itinerary.steps.map((step, i) =>
              step.kind === 'ride' ? (
                <li key={i} className="plan-step ride">
                  <span
                    className="step-chip"
                    style={{ background: planner.routes[step.routeIdx].color }}
                  >
                    {planner.routes[step.routeIdx].name}
                  </span>
                  <span className="step-body">
                    <strong>{planner.stops[step.from].name}</strong>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 5v14" />
                      <path d="m19 12-7 7-7-7" />
                    </svg>
                    <strong>{planner.stops[step.to].name}</strong>
                    <small>
                      {step.stopCount} halte &middot; ± {Math.round(step.minutes)} mnt &middot; arah {step.direction}
                    </small>
                  </span>
                </li>
              ) : (
                <li key={i} className="plan-step walk">
                  <Signpost size={15} strokeWidth={2.2} aria-hidden="true" />
                  <span className="step-body">
                    <span>Jalan kaki ± {formatMeters(step.meters)}</span>
                    <small>
                      {step.fromName} &rarr; {step.toName}
                    </small>
                  </span>
                </li>
              )
            )}
          </ol>
          <p className="plan-disclaimer">Estimasi dari jarak rute &amp; headway — bukan jadwal eksak.</p>
        </div>
      )}
    </aside>
  )
}

function formatMeters(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function popupHtml(name: string, routes: { name: string; color: string }[]) {
  const chips = routes
    .slice(0, 12)
    .map(r => `<span class="chip" style="background:${r.color}">${r.name}</span>`)
    .join('')
  const more = routes.length > 12 ? `<span style="font-size:.72rem;color:var(--ink-soft)">+${routes.length - 12} lainnya</span>` : ''
  return `<div class="peta-popup"><p class="popup-name"></p><div class="route-chips">${chips}${more}</div></div>`
    .replace('<p class="popup-name"></p>', `<p class="popup-name">${escapeHtml(name)}</p>`)
}

function escapeHtml(t: string) {
  return t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
