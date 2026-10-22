const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const billsHtml = fs.readFileSync('bills.html', 'utf8');
const sabresHtml = fs.readFileSync('sabres.html', 'utf8');
const scrapeJs = fs.readFileSync('scripts/scrape.js', 'utf8');

function extractFunc(content, name) {
  const re = new RegExp('function\\s+' + name + '\\([\\s\\S]*?\\n\\s*\\}', 'm');
  const m = content.match(re);
  return m ? m[0].replace(/\s+/g, ' ').trim() : null;
}

console.log('calculateLiveNhlWinChance:');
const nhlIndex = extractFunc(indexHtml, 'calculateLiveNhlWinChance');
const nhlBills = extractFunc(billsHtml, 'calculateLiveNhlWinChance');
const nhlSabres = extractFunc(sabresHtml, 'calculateLiveNhlWinChance');
const nhlScrape = extractFunc(scrapeJs, 'calculateLiveNhlWinChance');

console.log('In index.html:', !!nhlIndex);
console.log('In sabres.html:', !!nhlSabres);
console.log('In scrape.js:', !!nhlScrape);
console.log('Index === Sabres:', nhlIndex === nhlSabres);
console.log('Sabres === Scrape:', nhlSabres === nhlScrape);

console.log('\ncalculateLiveNflWinChance:');
const nflIndex = extractFunc(indexHtml, 'calculateLiveNflWinChance');
const nflBills = extractFunc(billsHtml, 'calculateLiveNflWinChance');
const nflScrape = extractFunc(scrapeJs, 'calculateLiveNflWinChance');

console.log('In index.html:', !!nflIndex);
console.log('In bills.html:', !!nflBills);
console.log('In scrape.js:', !!nflScrape);
console.log('Index === Bills:', nflIndex === nflBills);
console.log('Bills === Scrape:', nflBills === nflScrape);
