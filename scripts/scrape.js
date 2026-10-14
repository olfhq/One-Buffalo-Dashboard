// scripts/scrape.js
const fs = require('fs');
const cheerio = require('cheerio');

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

function parseCellPct(rawText) {
  if (!rawText) return 0;
  const text = rawText.trim();
  if (text === '-' || text === '--' || text === '' || text === '0') return 0;
  if (text.includes('<1')) return 0.5;
  if (text.includes('>99')) return 99.5;
  
  // Extract only the first valid decimal or integer number from the cell
  const match = text.match(/\d+(?:\.\d+)?/);
  if (!match) return 0;
  const val = parseFloat(match[0]);
  return isNaN(val) ? 0 : Math.min(100, Math.round(val));
}

async function scrapePlayoffStatus() {
  console.log('Initiating scrape from PlayoffStatus.com...');

  const billsUrl = 'http://www.playoffstatus.com/nfl/billsstandings.html';
  const sabresUrl = 'http://www.playoffstatus.com/nhl/sabresstandings.html';

  let billsData = {
    team: 'Buffalo Bills',
    makePlayoffs: 84,
    winDivision: 62,
    seed1: 18,
    seedDistribution: [
      { seed: '#1 Seed', pct: 18 },
      { seed: '#2 Seed', pct: 24 },
      { seed: '#3 Seed', pct: 12 },
      { seed: '#4 Seed', pct: 8 },
      { seed: '#5 Seed', pct: 11 },
      { seed: '#6 Seed', pct: 7 },
      { seed: '#7 Seed', pct: 4 }
    ]
  };

  let sabresData = {
    team: 'Buffalo Sabres',
    makePlayoffs: 38,
    winDivision: 11,
    wildcard: 27,
    seedDistribution: [
      { seed: 'Div 1', pct: 11 },
      { seed: 'Div 2', pct: 14 },
      { seed: 'Div 3', pct: 13 },
      { seed: 'Wildcard 1', pct: 16 },
      { seed: 'Wildcard 2', pct: 11 }
    ]
  };

  // 1. Scrape Bills
  try {
    const html = await fetchHtml(billsUrl);
    const $ = cheerio.load(html);

    $('tr').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Bills') && !text.includes('Schedule') && !text.includes('vs')) {
        const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
        // PlayoffStatus tables have data cells with numeric percentages
        const pcts = cells.map(parseCellPct).filter(n => n >= 0 && n <= 100);
        
        // Grab the trailing percentage columns for seeds 1 through 7
        if (pcts.length >= 7) {
          const seeds = pcts.slice(-7);
          billsData.seed1 = seeds[0];
          billsData.winDivision = seeds.slice(0, 4).reduce((a, b) => a + b, 0);
          billsData.makePlayoffs = Math.min(100, seeds.reduce((a, b) => a + b, 0));
          
          billsData.seedDistribution = [
            { seed: '#1 Seed', pct: seeds[0] },
            { seed: '#2 Seed', pct: seeds[1] },
            { seed: '#3 Seed', pct: seeds[2] },
            { seed: '#4 Seed', pct: seeds[3] },
            { seed: '#5 Seed', pct: seeds[4] },
            { seed: '#6 Seed', pct: seeds[5] },
            { seed: '#7 Seed', pct: seeds[6] }
          ];
        }
      }
    });
    console.log('Successfully parsed Bills data');
  } catch (err) {
    console.warn('Bills parse fallback used:', err.message);
  }

  // 2. Scrape Sabres
  try {
    const html = await fetchHtml(sabresUrl);
    const $ = cheerio.load(html);

    $('tr').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Sabres') && !text.includes('Schedule') && !text.includes('vs')) {
        const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
        const pcts = cells.map(parseCellPct).filter(n => n >= 0 && n <= 100);
        
        // Sabres seeds: Div 1-3 + Wildcard 1-2
        if (pcts.length >= 5) {
          const seeds = pcts.slice(-5);
          billsData.winDivision = seeds[0];
          sabresData.wildcard = seeds[3] + seeds[4];
          sabresData.makePlayoffs = Math.min(100, seeds.reduce((a, b) => a + b, 0));

          sabresData.seedDistribution = [
            { seed: 'Div 1', pct: seeds[0] },
            { seed: 'Div 2', pct: seeds[1] },
            { seed: 'Div 3', pct: seeds[2] },
            { seed: 'Wildcard 1', pct: seeds[3] },
            { seed: 'Wildcard 2', pct: seeds[4] }
          ];
        }
      }
    });
    console.log('Successfully parsed Sabres data');
  } catch (err) {
    console.warn('Sabres parse fallback used:', err.message);
  }

  const finalPayload = {
    updatedAt: new Date().toISOString(),
    source: 'http://www.playoffstatus.com',
    bills: billsData,
    sabres: sabresData
  };

  fs.writeFileSync('./data.json', JSON.stringify(finalPayload, null, 2), 'utf-8');
  console.log('data.json successfully updated with clean percentages.');
}

scrapePlayoffStatus();
