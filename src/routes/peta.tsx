import { createFileRoute, Link } from '@tanstack/react-router'
import { MapPinned } from 'lucide-react'
import '../styles/global.css'

export const Route = createFileRoute('/peta')({
  component: PetaPage,
})

function PetaPage() {
  return (
    <div className="shell">
      <main className="placeholder-main">
        <MapPinned size={44} strokeWidth={1.8} aria-hidden="true" />
        <h1>Petanya sedang dibangun</h1>
        <p>
          Peta interaktif rute TransJakarta &amp; Mikrotrans sedang disiapkan
          di Fase 1. Nantikan — datanya sudah di tangan.
        </p>
        <Link to="/" className="btn btn-ink">
          Kembali ke beranda
        </Link>
      </main>
    </div>
  )
}
