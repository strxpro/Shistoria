const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' 
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  page.on('requestfailed', request => console.log('REQ FAILED:', request.url(), request.failure().errorText));

  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle2' }).catch(console.error);
  
  await browser.close();
})();
