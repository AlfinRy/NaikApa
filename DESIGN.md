---
name: NaikApa
description: Poster diagram rute halte yang hidup — cream, tinta, pita koridor.
colors:
  primary: "#e4572e"
  neutral-bg: "#f6f3ea"
  neutral-bg-deep: "#efe9da"
  ink: "#20242b"
  ink-soft: "#3d4450"
  ribbon-green: "#2f9e63"
  ribbon-yellow: "#f2b705"
  ribbon-violet: "#7c5cbf"
  card-surface: "#fffdf6"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 9vw, 5.2rem)"
    fontWeight: 900
    lineHeight: 1.04
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.7rem, 5vw, 2.6rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    letterSpacing: "0.01em"
rounded:
  pill: "999px"
  card: "10px"
  tag: "6px"
  dot: "50%"
spacing:
  xs: "0.3rem"
  sm: "0.6rem"
  md: "1rem"
  lg: "1.8rem"
  xl: "2.5rem"
components:
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.pill}"
    padding: "0.55rem 1.1rem"
  button-ink-hover:
    backgroundColor: "{colors.primary}"
  button-hero:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.pill}"
    padding: "0.9rem 1.6rem"
  button-hero-active:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.ink}"
  chip-route:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.pill}"
    padding: "0.18rem 0.5rem"
---

# Design System: NaikApa

## Overview

**Creative North Star: "Poster Diagram Halte yang Hidup"**

NaikApa tampil sebagai poster diagram rute yang tertempel di dinding halte,
lalu bangun dan bekerja. Medannya kertas poster hangat, garisnya tinta gelap
tegas, dan warna koridor hadir sebagai DATA rute — bukan dekorasi. Halaman
bukan kumpulan kartu seragam: diagram, legenda, dan skala batang adalah
struktur aslinya. Satu momen motion yang diberi authorship per halaman;
sisanya state taktil (tombol tertekan membalik tinta).

**Key Characteristics:**
- Cream paper + tinta gelap; aksen vermilion tunggal untuk aksi utama
- Warna koridor (hijau/kuning/ungu) hanya untuk data rute & pita diagram
- Diagram adalah komponen first-class, bukan ilustrasi pelengkap
- Mobile-first; diagram lebar digeser (swipe), bukan dikecilkan
- Icon dari lucide, stroke konsisten — tidak ada emoji

## Colors

Palet poster: netral hangat membawa halaman, satu vermilion membawa aksi,
pita koridor membawa data.

### Primary
- **Vermilion Papan** (#e4572e): aksi utama (hover tombol ink, titik halte
  aktif, chip koridor K1, ikon aksen). Langka by design.

### Secondary
- **Hijau Pita** (#2f9e63): pita koridor sekunder & chip rute hijau.
- **Kuning Papan** (#f2b705): tag diagram (label koridor), chip transit;
  selalu dengan teks tinta.
- **Ungu Pita** (#7c5cbf): pita koridor tersilang di diagram.

### Neutral
- **Kertas Poster** (#f6f3ea): medan halaman.
- **Kertas Dalam** (#efe9da): hover nav, layer sekunder.
- **Tinta** (#20242b): teks, garis, tombol utama, footer.
- **Tinta Lembut** (#3d4450): teks sekunder (tint dari tinta, bukan abu).
- **Permukaan Kartu** (#fffdf6): kartu info halte di atas kertas.

### Named Rules
**The Data-Not-Decoration Rule.** Warna koridor hanya muncul terikat pada
objek rute (pita, chip, titik halte). Tidak pernah sebagai warna section,
heading, atau background dekoratif.

**The No-TransJakarta-Blue Rule.** Biru TransJakarta bukan identitas —
produk netral moda. (Komitmen brand dari PRODUCT.md.)

## Typography

**Display Font:** Archivo (fallback system-ui)
**Body Font:** Atkinson Hyperlegible (fallback system-ui)

**Character:** Archivo 800–900 condens tegas khas papan/rambu membawa
display & label; Atkinson Hyperlegible membaca panjang dengan aksesibilitas
tinggi — pilihan sadar untuk publik transportasi.

### Hierarchy
- **Display** (900, clamp(2.6rem, 9vw, 5.2rem), 1.04): judul hero, maksimal
  ~14ch.
- **Headline** (800, clamp(1.7rem, 5vw, 2.6rem)): judul section.
- **Title** (800, 1.02rem): judul item legenda.
- **Body** (400, 1.1rem, 1.55): copy utama; lead maks 42ch, caption 34ch.
- **Label** (700, 0.72–0.78rem): nama halte, tag diagram, chip — huruf kecil
  rapat di atas kertas.

### Named Rules
**The No-Eyebrow Rule.** Heading bicara sendiri; tanpa kicker/eyebrow di
atasnya.

## Layout

Kolom tunggal lebar `min(72rem, 100% - 2.5rem)`. Section dipisah garis tinta
2px penuh (bukan kartu mengambang). Ritme: ruang di atas heading lebih besar
daripada di bawahnya. Diagram track min-width 660px dalam wadah scroll
horizontal dengan mask fade tepi + hint geser. Hero button full-width di
≤560px.

## Elevation & Depth

Datar by default — poster. Satu bayangan lembut dengan offset untuk kartu
info halte terpilih:

- **Kartu Halte** (`box-shadow: 4px 6px 18px rgba(32,36,43,0.16)`): hanya
  pada popover diagram aktif.

### Named Rules
**The Flat-Poster Rule.** Tanpa bayangan kecuali elemen yang benar-benar
mengangkat dari poster (popovers/tooltip aktif). Tanpa hard-offset shadow.

## Shapes

Bahasa bentuk papan: garis tepi tinta 2px, sudut kecil tegas. Pill penuh
(999px) untuk tombol & chip; kartu 10px; tag 6px; titik halte lingkaran
penuh dengan cincin tinta 3px. Border 2px solid ink adalah "frame" dunia.

## Components

### Buttons
- **Shape:** pill penuh (999px), border 2px tinta.
- **Primary (ink):** bg tinta, teks kertas (padding 0.55rem 1.1rem).
- **Hero:** bg tinta (0.9rem 1.6rem, 1.1rem); hover → vermilion; active →
  invert (bg kertas, teks tinta) + translateY(1px) — taktil ditekan.
- **Ghost/nav:** teks tinta pill; hover bg kertas-dalam.

### Chips
- **Route chip:** pill, border 2px tinta, bg warna koridor rute (K1
  vermilion/kertas; K5 kuning/tinta; K6 hijau/kertas). 0.72rem 800.

### Cards / Containers
- **Stop card (popover):** border 2px tinta, radius 10px, bg #fffdf6,
  bayangan lembut, padding 0.7rem 1rem. Konten: ikon MapPin, nama halte
  bold, chips rute, catatan demo.

### Navigation
- Header sticky bg kertas, border-bottom 2px tinta; wordmark Archivo 900 +
  ikon signpost vermilion; nav-link pill; CTA "Buka Peta" ink pill.

### Diagram Koridor (signature)
- Track: pita 7px vermilion horizontal, pita silang 3px (hijau -2.6°, ungu
  +2.1°, opacity .55), halte = tombol lingkaran 17px cincin tinta 3px di
  atas pita, label bergantian atas/bawah, bg kertas.
- Interaksi: pilih halte → segmen `.travel` scaleX 420ms
  cubic-bezier(0.16,1,0.3,1) + titik menyala berurutan (delay 45ms/stop).
  Ini SATU momen motion halaman.
- State halte: hover scale 1.18; lit = fill vermilion.

## Do's and Don'ts

### Do:
- **Do** pakai warna koridor hanya terikat data rute (pita/chip/titik).
- **Do** pisah section dengan garis tinta 2px, bukan bayangan kartu.
- **Do** buat diagram bisa digeser di mobile (min-width 660px + mask fade).
- **Do** beri label "demo" pada data peraga yang belum final.

### Don't:
- **Don't** pakai biru TransJakarta sebagai identitas brand.
- **Don't** pakai emoji — icon selalu dari lucide, stroke konsisten.
- **Don't** tambah animasi selain momen tunggal yang authored.
- **Don't** buat kartu fitur seragam icon+judul+teks sebagai struktur
  halaman; struktur halaman adalah diagram/legenda/skala.
- **Don't** pakai kicker/eyebrow di atas heading.
