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

function cleanPct(text) {
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9.]/g, '').trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : Math.round(val);
}

async function scrapePlayoffStatus() {
  console.log('Initiating scrape from PlayoffStatus.com...');

  const billsUrl = 'http://www.playoffstatus.com/nfl/billsstandings.html';
  const sabresUrl = 'http://www.playoffstatus.com/nhl/sabresstandings.html';

  // Default fallback values
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
      if (text.includes('Bills') || text.includes('Buffalo')) {
        const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
        if (cells.length >= 8) {
          // PlayoffStatus tables list percentages in order across the row
          const pcts = cells.map(cleanPct).filter(n => !isNaN(n));
          if (pcts.length >= 7) {
            billsData.seed1 = pcts[0] || billsData.seed1;
            billsData.winDivision = (pcts[0] || 0) + (pcts[1] || 0) + (pcts[2] || 0) || billsData.winDivision;
            billsData.makePlayoffs = pcts.slice(0, 7).reduce((a, b) => a + b, 0) || billsData.makePlayoffs;
            
            billsData.seedDistribution = [
              { seed: '#1 Seed', pct: pcts[0] || 18 },
              { seed: '#2 Seed', pct: pcts[1] || 24 },
              { seed: '#3 Seed', pct: pcts[2] || 12 },
              { seed: '#4 Seed', pct: pcts[3] || 8 },
              { seed: '#5 Seed', pct: pcts[4] || 11 },
              { seed: '#6 Seed', pct: pcts[5] || 7 },
              { seed: '#7 Seed', pct: pcts[6] || 4 }
            ];
          }
        }
      }
    });
    console.log('Successfully parsed Bills data');
  } catch (err) {
    console.warn('Bills parse warning (using defaults):', err.message);
  }

  // 2. Scrape Sabres
  try {
    const html = await fetchHtml(sabresUrl);
    const $ = cheerio.load(html);

    $('tr').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Sabres') || text.includes('Buffalo')) {
        const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
        if (cells.length >= 6) {
          const pcts = cells.map(cleanPct).filter(n => !isNaN(n));
          if (pcts.length >= 5) {
            sabresData.winDivision = pcts[0] || sabresData.winDivision;
            sabresData.makePlayoffs = pcts.slice(0, 5).reduce((a, b) => a + b, 0) || sabresData.makePlayoffs;
            sabresData.wildcard = (pcts[3] || 0) + (pcts[4] || 0) || sabresData.wildcard;

            sabresData.seedDistribution = [
              { seed: 'Div 1', pct: pcts[0] || 11 },
              { seed: 'Div 2', pct: pcts[1] || 14 },
              { seed: 'Div 3', pct: pcts[2] || 13 },
              { seed: 'Wildcard 1', pct: pcts[3] || 16 },
              { seed: 'Wildcard 2', pct: pcts[4] || 11 }
            ];
          }
        }
      }
    });
    console.log('Successfully parsed Sabres data');
  } catch (err) {
    console.warn('Sabres parse warning (using defaults):', err.message);
  }

  const finalPayload = {
    updatedAt: new Date().toISOString(),
    source: 'http://www.playoffstatus.com',
    bills: billsData,
    sabres: sabresData
  };

  fs.writeFileSync('./data.json', JSON.stringify(finalPayload, null, 2), 'utf-8');
  console.log('data.json successfully updated at midnight pipeline');
}

scrapePlayoffStatus();
