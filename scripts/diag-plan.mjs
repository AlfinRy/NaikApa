/* Uji trip planner UI: buka panel, isi asal/tujuan, cek itinerary */
import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu'],
})
try {
  const page = await browser.newPage()
  page.setViewport({ width: 390, height: 844 })
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 250)) })
  page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 300)))

  await page.goto('http://localhost:3001/peta', { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction(() => !!document.querySelector('.peta-card'), { timeout: 30000 })
  await new Promise(r => setTimeout(r, 2000))

  /* 1. buka panel rute */
  await page.click('.plan-fab')
  await page.waitForFunction(() => !!document.querySelector('.plan-panel'), { timeout: 30000 })
  console.log('1. Panel rute terbuka:', !!(await page.$('.plan-panel')))

  /* 2. isi asal: blok m */
  const inputs = await page.$$('.plan-input-row .search-field input')
  await inputs[0].click()
  await inputs[0].type('blok m')
  await page.waitForFunction(() => document.querySelectorAll('.plan-input-row .search-results .result').length > 0, { timeout: 30000 })
  await page.keyboard.press('Enter')
  await new Promise(r => setTimeout(r, 400))

  /* 3. isi tujuan: kota */
  const inputs2 = await page.$$('.plan-input-row .search-field input')
  await inputs2[1].click()
  await inputs2[1].type('kota')
  await page.waitForFunction(() => document.querySelectorAll('.plan-input-row .search-results .result').length > 0, { timeout: 30000 })
  await page.keyboard.press('Enter')
  await new Promise(r => setTimeout(r, 500))

  /* 4. tunggu hasil */
  let ok = false
  try {
    await page.waitForFunction(() => !!document.querySelector('.plan-result'), { timeout: 30000 })
    ok = true
  } catch {}
  if (ok) {
    const res = await page.evaluate(() => ({
      summary: document.querySelector('.plan-summary')?.textContent?.replace(/\s+/g, ' ').trim(),
      steps: [...document.querySelectorAll('.plan-step')].map(li => li.textContent?.replace(/\s+/g, ' ').trim().slice(0, 110)),
      markers: window.__naikapa ? 'n/a' : '',
    }))
    console.log('2. Hasil:', JSON.stringify(res.summary))
    res.steps.forEach(s => console.log('   -', s))
  } else {
    console.log('2. HASIL TIDAK MUNCUL')
  }

  /* 5. cek highlight polyline */
  const hl = await page.evaluate(() => {
    const lines = window.__naikapa?.lines ?? []
    const dim = lines.filter(l => l.line.options.opacity < 0.2).length
    const lit = lines.filter(l => l.line.options.opacity >= 0.99)
    return { total: lines.length, dim, litRoutes: [...new Set(lit.map(l => l.route))].slice(0, 5) }
  })
  console.log('3. Highlight:', JSON.stringify(hl))
  await page.screenshot({ path: '.impeccable/review/plan-mobile.png' })
  console.log('ERRORS:', errors.length ? errors : 'none')
} finally { await browser.close() }
