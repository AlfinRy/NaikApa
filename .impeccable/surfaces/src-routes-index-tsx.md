---
version: 1
slug: "src-routes-index-tsx"
primary_target: "src/routes/index.tsx"
related_targets: []
---

# Surface brief — Landing page (/)

Mode: Persuade. Audiens: publik Jabodetabek, HP-first, sedang mencari tahu
"naik apa". Job: paham isi NaikApa dalam hitungan detik, lalu klik ke /peta.
Aksi: CTA utama "Buka Peta" + nav. Bukti: demo diagram koridor hidup di hero
(label synthetic). Batasan: minimal animasi, non-monochrome, mobile-first,
icon lucide (tanpa emoji), identitas TIDAK biru TransJakarta.

## Direction contract

THESIS: Halaman adalah poster diagram rute halte yang hidup — pita koridor
menyapu halaman, halte menjadi titik yang bisa disentuh — menolak template
hero-gradien + kartu fitur seragam standar kategori transit.

OWN-WORLD: Kertas poster hangat (#f6f3ea) dengan tinta gelap (#20242b);
pita koridor multi-warna (vermilion, hijau, kuning, ungu, teal) sebagai DATA,
bukan dekorasi; titik halte putih ber-cincin tinta; garis 45°/siku diagram;
heading grotesque besar; label halte kecil rapat. Dikenali tanpa konten
sekalipun lewat pita + titik + takarim legenda.

STORY: Pengunjung paham "satu peta untuk semua rute bus + cari tujuan +
trip planner" dari diagram yang sedang dikerjakan halaman ini, percaya karena
melihat rute/halte nyata, lalu menekan tombol ke /peta.

FIRST VIEWPORT: Mobile-first. Atas: wordmark NaikApa + nav "Peta" + CTA pill
ink. Tengah: heading 2 baris bertumpuk pada pita koridor vermilion yang
menyapu horizontal (mobile: vertikal), titik-titik halte nyata menempel
dengan nama; satu titik aktif menyala dengan kartu kecil "halte terdekat".
Bawah: CTA utama besar "Buka Peta →" full-width ink di atas taktil
(pressed-state invert). Diagram di-hero adalah synthetic-demo, diberi label.

FORM: Peta Koridor di Dinding Halte — kandidat grounded #2 (pick), seed key
7bc2a36b, dipilih user dari decision page (kalahkan assigned departure
board pada identifikasi audiens & kejelasan produk).

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying
its provenance.

## Unresolved
- Data rute di hero: pakai subset GTFS asli (koridor 1) — sudah tersedia.
- /peta masih placeholder sampai Fase 1 selesai.
