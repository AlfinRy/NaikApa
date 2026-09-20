/* Uji interaktivitas end-to-end: klik, toggle, navigasi klien */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'],
})
try {
  const page = await browser.newPage()
  page.setViewport({ width: 390, height: 844 }) // mobile viewport
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
  page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 300)))

  /* --- 1. HOME: klik halte pada diagram --- */
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 1500))
  const before = await page.evaluate(() => document.querySelector('.stop-card strong')?.textContent)
  const clicked = await page.evaluate(() => {
    const stops = [...document.querySelectorAll('.diagram-track .stop')]
    const target = stops.find(s => s.getAttribute('aria-label')?.includes('Harmoni'))
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return !!target
  })
  await new Promise(r => setTimeout(r, 400))
  const after = await page.evaluate(() => ({
    card: document.querySelector('.stop-card strong')?.textContent ?? null,
    pressed: document.querySelector('.stop[aria-pressed="true"]')?.getAttribute('aria-label') ?? null,
  }))
  console.log('1. HOME klik halte:', JSON.stringify({ clicked, before, after }))

  /* --- 2. HOME: navigasi klien ke /peta via link --- */
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('a')].find(a => a.getAttribute('href') === '/peta')
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await page.waitForFunction(() => !!document.querySelector('.leaflet-container'), { timeout: 20000 })
  const navUrl = page.url()
  console.log('2. Navigasi klien -> peta:', navUrl, '(leaflet OK tanpa full reload)')

  /* --- 3. PETA: tunggu layer, lalu toggle Mikrotrans off --- */
  await page.waitForFunction(() => !!document.querySelector('.peta-card'), { timeout: 15000 })
  await new Promise(r => setTimeout(r, 2500))
  const layersBefore = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas').length
    const checks = [...document.querySelectorAll('.peta-toggle input')].map(i => i.checked)
    return { canvases, checks }
  })
  await page.evaluate(() => {
    const mikro = [...document.querySelectorAll('.peta-toggle input')][1]
    mikro.click()
  })
  await new Promise(r => setTimeout(r, 800))
  const layersAfter = await page.evaluate(() => ({
    checks: [...document.querySelectorAll('.peta-toggle input')].map(i => i.checked),
  }))
  console.log('3. Toggle layer:', JSON.stringify({ before: layersBefore, after: layersAfter }))

  /* --- 4. PETA: screenshot desktop juga --- */
  await page.setViewport({ width: 1440, height: 900 })
  await new Promise(r => setTimeout(r, 1200))
  await page.screenshot({ path: '.impeccable/review/peta-desktop.png' })
  console.log('4. Screenshot peta-desktop tersimpan')
  console.log('ERRORS:', errors.length ? errors : 'none')
} finally { await browser.close() }
