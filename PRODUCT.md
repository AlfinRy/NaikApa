# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TanStack Start (React, SSR), Vite 7, Leaflet + OSM tiles. Data: GTFS statis
resmi TransJakarta diolah ke SQLite. (Dikonfirmasi user, Fase 0.)

## Users

Publik umum pengguna/calon pengguna transportasi di Jabodetabek. Mayoritas
mengakses dari ponsel (HP-first), situasi: ingin tahu rute apa yang bisa
dinaiiki menuju suatu tempat — mencari nama tempat atau nama halte.

## Product Purpose

Web yang memetakan rute TransJakarta & Mikrotrans di peta interaktif, dengan
trip planner: user memasukkan tujuan (nama tempat/nama halte), sistem
menampilkan kombinasi rute + transit sampai tujuan. Sukses = user cepat tahu
"naik apa" tanpa perlu aplikasi lain.

## Positioning

Trip planner peta yang ringan, gratis, tanpa login, fokus bus TransJakarta +
Mikrotrans — bukan aplikasi resmi TransJakarta, tidak berafiliasi. Cakupan
moda bisa berkembang (KRL/MRT/LRT) di masa depan.

## Operating Context

Penggunaan di HP saat merencanakan atau sedang berjalan; koneksi tidak selalu
stabil; pencarian dua jenis: nama halte (dari data) dan nama tempat
(geocoding Nominatim/OSM).

## Capabilities and Constraints

- Fase MVP: hanya TransJakarta BRT + Mikrotrans (route_type bus).
- Tanpa data real-time — estimasi waktu dari headway GTFS statis.
- Landing page sebagai pintu masuk → CTA ke halaman peta terpisah (/peta).
- UI: mobile-first/responsive, bukan monochrome, animasi secukupnya saja.

## Brand Commitments

- Nama: "NaikApa" (binding).
- JANGAN branding berlebihan ke biru TransJakarta — identitas harus netral
  moda karena bisa berkembang ke moda lain. Warna koridor tetap dipakai untuk
  data di peta, bukan sebagai warna identitas brand.
- Bahasa antarmuka: Indonesia.
- Icon wajib dari icon library (mis. lucide) — TIDAK pakai emoji di UI (binding).

## Evidence on Hand

- GTFS resmi (241 rute, 8.091 halte, warna & shape per rute) di data/gtfs/.
  Tidak ada testimoni/press/aset foto — jangan difabrikasi.

## Product Principles

1. Cepat jawab pertanyaan "naik apa?" — di atas segalanya.
2. HP dulu: layout dan interaksi didesain untuk layar kecil.
3. Netral moda: identitas tidak terkunci ke satu operator.
4. Ringan & gratis: tanpa login, tanpa paywall, tanpa hiasan berlebihan.

## Accessibility & Inclusion

Target pengguna umum dengan device bervariasi — kontras teks memadai,
target sentuh cukup besar, teks Bahasa Indonesia sederhana.
