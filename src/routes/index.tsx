import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowRight, ChevronsRight, MapPin } from 'lucide-react'
import '../styles/global.css'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

/* Subset halte Koridor 1 (Blok M – Kota), data GTFS resmi.
   Demo interaktif — bukan jadwal operasional. */
const KORIDOR_1_STOPS = [
  { name: 'Blok M', interchange: false },
  { name: 'Senayan', interchange: false },
  { name: 'Bendungan Hilir', interchange: false },
  { name: 'Setiabudi', interchange: false },
  { name: 'Dukuh Atas', interchange: true },
  { name: 'Sarinah', interchange: true },
  { name: 'Monas', interchange: false },
  { name: 'Harmoni', interchange: true },
  { name: 'Pecenongan', interchange: false },
  { name: 'Kota', interchange: false },
]

function LandingPage() {
  const [selected, setSelected] = useState<number>(4)

  return (
    <div className="shell">
      <header className="site-header">
        <div className="container">
          <Link to="/" className="wordmark">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 22V2" />
              <path d="m8 6 4-4 4 4" />
              <path d="m4 14 4-4 4 4" />
              <path d="m12 14 4-4 4 4" />
            </svg>
            NaikApa
          </Link>
          <nav className="header-nav">
            <Link to="/peta" className="nav-link">
              Peta
            </Link>
            <Link to="/peta" className="btn btn-ink">
              Buka Peta
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container">
            <div className="hero-grid">
              <div>
                <h1 className="hero-title">
                  Naik apa?
                  <br />
                  <em>Satu peta</em> menjawab.
                </h1>
                <p className="hero-sub">
                  Semua rute TransJakarta &amp; Mikrotrans Jabodetabek dalam
                  satu peta. Cari nama tempat atau nama halte, langsung tahu
                  rute yang harus dinaiki — lengkap dengan pilihan transit.
                </p>
              </div>

              <div className="diagram-wrap">
                <span className="diagram-tag">Koridor 1 — Blok M ↔ Kota</span>

                <div className="diagram-scroll">
                  <div className="diagram-track" role="group" aria-label="Demo diagram Koridor 1">
                    <span className="ribbon-cross green" aria-hidden="true" />
                    <span className="ribbon-cross violet" aria-hidden="true" />
                    {selected >= 0 && (
                      <span
                        className="travel"
                        style={{
                          transform: `translateY(-50%) scaleX(${stopPosition(selected) / 100})`,
                        }}
                        aria-hidden="true"
                      />
                    )}
                    {KORIDOR_1_STOPS.map((stop, i) => (
                      <button
                        key={stop.name}
                        type="button"
                        className={`stop ${i % 2 === 0 ? 'above' : 'below'} ${
                          i <= selected ? 'lit' : ''
                        }`}
                        style={{
                          left: `${stopPosition(i)}%`,
                          transitionDelay: `${i * 45}ms`,
                        }}
                        aria-label={`Halte ${stop.name}${
                          stop.interchange ? ', halte transit utama' : ''
                        }`}
                        aria-pressed={selected === i}
                        onClick={() => setSelected(selected === i ? -1 : i)}
                      >
                        <span className="stop-dot" aria-hidden="true" />
                        <span className="stop-label">{stop.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <span className="swipe-hint">
                  <ChevronsRight size={15} strokeWidth={2.2} aria-hidden="true" />
                  Geser &amp; sentuh halte untuk melihat segmen perjalanan
                </span>

                {selected >= 0 && (
                  <div className="stop-card" role="status">
                    <MapPin size={20} strokeWidth={2.2} aria-hidden="true" />
                    <strong>{KORIDOR_1_STOPS[selected].name}</strong>
                    <span className="route-chips">
                      <span className="chip k1">K1</span>
                      {KORIDOR_1_STOPS[selected].interchange && (
                        <span className="chip k5">Halte transit utama</span>
                      )}
                    </span>
                    <span className="demo-note">demo — data GTFS resmi</span>
                  </div>
                )}
              </div>

              <div className="hero-actions">
                <Link to="/peta" className="btn btn-hero">
                  Buka Peta
                  <ArrowRight size={19} strokeWidth="2.4" aria-hidden="true" />
                </Link>
                <a className="quiet-link" href="#cara">
                  Cara membacanya
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="legend-section" id="cara">
          <div className="container">
            <h2>Cara membaca NaikApa</h2>
            <div className="legend-grid">
              <div className="legend-item">
                <svg
                  className="glyph"
                  width="40"
                  height="34"
                  viewBox="0 0 40 34"
                  fill="none"
                  aria-hidden="true"
                >
                  <line x1="3" y1="24" x2="37" y2="24" stroke="#20242b" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="12" cy="24" r="3.4" fill="#f6f3ea" stroke="#20242b" strokeWidth="2.5" />
                  <circle cx="28" cy="24" r="3.4" fill="#f6f3ea" stroke="#20242b" strokeWidth="2.5" />
                  <circle cx="22" cy="11" r="6.5" stroke="#20242b" strokeWidth="2.5" />
                  <line x1="26.5" y1="15.5" x2="31" y2="20" stroke="#20242b" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <div>
                  <h3>Cari tempat atau halte</h3>
                  <p>
                    Ketik nama tempat (&ldquo;Monas&rdquo;) atau nama halte —
                    keduanya sama-sama bisa.
                  </p>
                </div>
              </div>

              <div className="legend-item">
                <svg
                  className="glyph"
                  width="40"
                  height="34"
                  viewBox="0 0 40 34"
                  fill="none"
                  aria-hidden="true"
                >
                  <line x1="3" y1="17" x2="37" y2="17" stroke="#20242b" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
                  <line x1="12" y1="17" x2="30" y2="17" stroke="#e4572e" strokeWidth="5" strokeLinecap="round" />
                  <circle cx="12" cy="17" r="3.4" fill="#e4572e" stroke="#20242b" strokeWidth="2.5" />
                  <circle cx="21" cy="17" r="3.4" fill="#f6f3ea" stroke="#20242b" strokeWidth="2.5" />
                  <circle cx="30" cy="17" r="3.4" fill="#e4572e" stroke="#20242b" strokeWidth="2.5" />
                </svg>
                <div>
                  <h3>Lihat rute yang lewat</h3>
                  <p>
                    Setiap rute menyala dengan warna koridornya sendiri di
                    atas peta.
                  </p>
                </div>
              </div>

              <div className="legend-item">
                <svg
                  className="glyph"
                  width="40"
                  height="34"
                  viewBox="0 0 40 34"
                  fill="none"
                  aria-hidden="true"
                >
                  <line x1="3" y1="10" x2="37" y2="26" stroke="#2f9e63" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="3" y1="26" x2="37" y2="10" stroke="#7c5cbf" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="20" cy="18" r="4" fill="#f6f3ea" stroke="#20242b" strokeWidth="2.5" />
                </svg>
                <div>
                  <h3>Rencanakan dengan transit</h3>
                  <p>
                    Trip planner menyusun kombinasi rute, termasuk pindah
                    koridor di halte transit.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="scale-section">
          <div className="container">
            <div className="scale-marks">
              <div className="scale-mark">
                <strong>14</strong>
                <span>Koridor BRT</span>
              </div>
              <div className="scale-mark">
                <strong>240+</strong>
                <span>Rute bus terdata</span>
              </div>
              <div className="scale-mark">
                <strong>8.000+</strong>
                <span>Halte &amp; pemberhentian</span>
              </div>
            </div>
            <div className="scale-bar" aria-hidden="true" />
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <span className="wordmark">NaikApa</span>
          <small>
            Proyek independen — bukan aplikasi resmi TransJakarta.
            <br />
            Data rute &amp; halte dari GTFS resmi TransJakarta.
          </small>
        </div>
      </footer>
    </div>
  )
}

function stopPosition(i: number) {
  const n = KORIDOR_1_STOPS.length
  return (i / (n - 1)) * 96 + 2
}
