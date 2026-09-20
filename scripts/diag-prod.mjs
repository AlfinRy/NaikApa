import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu'],
})
try {
  const page = await browser.newPage()
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
  page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 250)))
  await page.goto('http://localhost:3000/peta', { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 4000))
  const info = await page.evaluate(() => ({
    leaflet: !!document.querySelector('.leaflet-container'),
    layerPanel: !!document.querySelector('.peta-card'),
    fab: !!document.querySelector('.plan-fab'),
    loading: !!document.querySelector('.peta-loading'),
  }))
  console.log('PROD /peta:', JSON.stringify(info))
  console.log('errors:', errors.length ? errors.slice(0, 4) : 'none')
} finally { await browser.close() }
