/* Uji search box: autocomplete halte, pilih, highlight rute, popup, Nominatim */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'],
})
try {
  const page = await browser.newPage()
  page.setViewport({ width: 390, height: 844 })
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 250)) })
  page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 300)))

  await page.goto('http://localhost:3001/peta', { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction(() => !!document.querySelector('.peta-card'), { timeout: 30000 })
  await new Promise(r => setTimeout(r, 2500))

  /* 1. ketik 'monas' — dropdown muncul */
  await page.click('.search-field input')
  await page.type('.search-field input', 'monas')
  await page.waitForFunction(() => document.querySelectorAll('.search-results .result').length > 0, { timeout: 10000 })
  const dropdown = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.search-results .result')]
    return items.map(i => ({
      name: i.querySelector('.result-name')?.textContent,
      kind: i.querySelector('.result-kind')?.textContent,
    })).slice(0, 6)
  })
  console.log('1. Dropdown "monas":', JSON.stringify(dropdown))

  /* 2. pilih halte pertama via keyboard Enter */
  await page.keyboard.press('Enter')
  await new Promise(r => setTimeout(r, 1600))
  const state = await page.evaluate(() => ({
    query: document.querySelector('.search-field input')?.value,
    popupVisible: !!document.querySelector('.leaflet-popup'),
    popupName: document.querySelector('.popup-name')?.textContent ?? null,
    mapCenter: (window.__TSS_ROUTER__ ? 'router-ok' : ''),
  }))
  const zoom = await page.evaluate(() => document.querySelector('.peta-map')?.getAttribute('data-zoom') ?? '')
  console.log('2. Setelah Enter:', JSON.stringify(state), '| popup terbuka:', state.popupVisible)

  /* 3. cek highlight: opacity polyline — hitung lewat atribut? gunakan screenshot */
  await page.screenshot({ path: '.impeccable/review/search-halte.png' })

  /* 4. ketik 'kota tua' — cek hasil Nominatim muncul (butuh jaringan) */
  const clearBtn = document_exists => null
  await page.click('.search-clear')
  await page.type('.search-field input', 'kota tua')
  let nominatimOk = false
  try {
    await page.waitForFunction(
      () => [...document.querySelectorAll('.search-results .result-kind')].some(k => k.textContent === 'tempat'),
      { timeout: 15000 }
    )
    nominatimOk = true
  } catch {}
  const placesList = await page.evaluate(() =>
    [...document.querySelectorAll('.search-results .result.place .result-name')].map(n => n.textContent).slice(0, 5)
  )
  console.log('3. Nominatim "kota tua":', nominatimOk ? JSON.stringify(placesList) : 'TIDAK MUNCUL (cek jaringan/proxy)')

  /* 5. pilih tempat pertama */
  if (nominatimOk) {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.search-results .result.place')][0]
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await new Promise(r => setTimeout(r, 2000))
    const placeState = await page.evaluate(() => ({
      popupVisible: !!document.querySelector('.leaflet-popup'),
      popupName: document.querySelector('.popup-name')?.textContent ?? null,
    }))
    console.log('4. Setelah pilih tempat:', JSON.stringify(placeState))
    await page.screenshot({ path: '.impeccable/review/search-tempat.png' })
  }

  console.log('ERRORS:', errors.length ? errors : 'none')
} finally { await browser.close() }
