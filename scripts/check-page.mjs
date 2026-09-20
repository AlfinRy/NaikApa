/* Diagnosa cepat: apakah hydration & peta jalan di browser sungguhan?
   Jalankan: node scripts/check-page.mjs [path] */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const path = process.argv[2] || '/'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
})

try {
  const page = await browser.newPage()
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)) })
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)))

  await page.goto(`http://localhost:3001${path}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 3000))

  const info = await page.evaluate(() => ({
    leaflet: !!document.querySelector('.leaflet-container'),
    panes: document.querySelectorAll('.leaflet-pane').length,
    canvases: document.querySelectorAll('canvas').length,
    loading: !!document.querySelector('.peta-loading'),
    layerPanel: !!document.querySelector('.peta-card'),
    stopCard: !!document.querySelector('.stop-card'),
    title: document.title,
  }))
  console.log(JSON.stringify(info, null, 2))
  console.log('console errors:', errors.length ? errors.slice(0, 5) : 'none')
  await page.screenshot({ path: `.impeccable/review/check${path === '/' ? '-home' : '-peta'}.png` })
} finally {
  await browser.close()
}
