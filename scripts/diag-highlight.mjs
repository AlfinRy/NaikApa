/* Verifikasi highlight: pilih halte Harmoni, cek opacity polyline */
import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu'],
})
try {
  const page = await browser.newPage()
  page.setViewport({ width: 390, height: 844 })
  const errors = []
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
  await page.goto('http://localhost:3001/peta', { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction(() => !!window.__naikapa?.lines?.length, { timeout: 30000 })

  const before = await page.evaluate(() => {
    const ops = window.__naikapa.lines.map(l => l.line.options.opacity)
    return { total: ops.length, dim: ops.filter(o => o < 0.2).length }
  })
  await page.click('.search-field input')
  await page.type('.search-field input', 'harmoni')
  await page.waitForFunction(() => document.querySelectorAll('.search-results .result').length > 0, { timeout: 10000 })
  await page.keyboard.press('Enter')
  await new Promise(r => setTimeout(r, 1200))

  const after = await page.evaluate(() => {
    const lines = window.__naikapa.lines
    const ops = lines.map(l => l.line.options.opacity)
    const lit = lines.filter(l => l.line.options.opacity >= 0.99)
    return {
      total: ops.length,
      dim: ops.filter(o => o < 0.2).length,
      litNames: [...new Set(lit.map(l => l.route))].slice(0, 12),
    }
  })
  console.log('SEBELUM:', JSON.stringify(before))
  console.log('SESUDAH:', JSON.stringify(after))
  console.log('ERRORS:', errors.length ? errors : 'none')
} finally { await browser.close() }
