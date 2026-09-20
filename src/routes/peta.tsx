import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
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

function PetaPage() {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const [network, setNetwork] = useState<Network | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showBrt, setShowBrt] = useState(true)
  const [showMikro, setShowMikro] = useState(true)
  const layersRef = useRef<{ brt?: LayerGroup; mikro?: LayerGroup }>({})

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

      const mkGroup = (cls: 'BRT' | 'MIKRO') => {
        const group = L.layerGroup()

        const routes = network.routes.filter(r => r.class === cls)
        for (const r of routes) {
          for (const line of r.lines) {
            L.polyline(line, {
              color: r.color,
              weight: cls === 'BRT' ? 3.5 : 1.8,
              opacity: cls === 'BRT' ? 0.9 : 0.7,
              lineCap: 'round',
            }).addTo(group)
          }
        }

        for (const s of network.stops) {
          const isBrtStop = s.routes.some(r => r.brt)
          if (cls === 'BRT' && !isBrtStop) continue
          if (cls === 'MIKRO' && isBrtStop) continue
          L.circleMarker([s.lat, s.lon], {
            radius: isBrtStop ? 4 : 2,
            color: '#20242b',
            weight: 1.2,
            fillColor: isBrtStop ? '#f6f3ea' : s.routes[0]?.color || '#7c5cbf',
            fillOpacity: isBrtStop ? 1 : 0.8,
          })
            .bindPopup(popupHtml(s))
            .addTo(group)
        }

        return group
      }

      layersRef.current.brt = mkGroup('BRT')
      layersRef.current.mikro = mkGroup('MIKRO')
      if (showBrt) layersRef.current.brt.addTo(map)
      if (showMikro) layersRef.current.mikro.addTo(map)
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
