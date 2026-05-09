const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  page.on('request', req => {
    const url = req.url();
    if (url.includes('studio-api') || url.includes('clerk.suno')) {
      console.log('REQ:', req.method(), url.replace('https://studio-api.prod.suno.com','').replace('https://suno.com',''));
      const h = req.headers();
      if (h['authorization']) console.log('  Auth:', h['authorization'].substring(0, 60) + '...');
      if (h['cookie']) console.log('  Cookie:', h['cookie'].substring(0, 200));
    }
  });
  
  page.on('response', resp => {
    const url = resp.url();
    if (url.includes('studio-api') || url.includes('clerk.suno')) {
      console.log('RES:', resp.status(), url.replace('https://studio-api.prod.suno.com','').replace('https://suno.com',''));
    }
  });

  console.log('Going to suno.com...');
  try {
    await page.goto('https://suno.com', { waitUntil: 'networkidle', timeout: 20000 });
  } catch(e) {
    console.log('Nav note:', e.message.substring(0, 100));
  }
  
  await page.waitForTimeout(3000);
  console.log('Current URL:', page.url());
  
  // Get cookies
  const cookies = await context.cookies('https://suno.com');
  console.log('\nAuth cookies (truncated):');
  for (const c of cookies) {
    if (c.value.includes('eyJ') || c.name.includes('session') || c.name.includes('client') || c.name.includes('clerk')) {
      const v = c.value.length > 80 ? c.value.substring(0, 80) + '...' : c.value;
      console.log(`  ${c.name}: ${v}`);
    }
  }
  
  // localStorage tokens
  const tok = await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      const v = localStorage.getItem(k);
      if (v && v.startsWith('eyJ')) return { key: k, len: v.length, prefix: v.substring(0, 50) };
    }
    return null;
  });
  console.log('\nlocalStorage token:', tok);

  // Try create page
  try {
    await page.goto('https://suno.com/create', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000);
  } catch(e) {}
  
  console.log('Final URL:', page.url());
  
  await browser.close();
  console.log('\nDone.');
})();