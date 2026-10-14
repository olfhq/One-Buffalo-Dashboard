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
  
  const match = text.match(/\d+(?:\.\d+)?/);
  if (!match) return 0;
  const val = parseFloat(match[0]);
  return isNaN(val) ? 0 : Math.min(100, Math.round(val));
}

async function scrapePlayoffStatus() {
  console.log('Initiating full matrix scrape from PlayoffStatus.com...');

  const billsUrl = 'http://www.playoffstatus.com/nfl/billsstandings.html';
  const sabresUrl = 'http://www.playoffstatus.com/nhl/sabresstandings.html';
  const billsMigUrl = 'http://www.playoffstatus.com/nfl/billsmig.html';

  let billsData = {
    team: 'Buffalo Bills',
    makePlayoffs: 84,
    winDivision: 62,
    seed1: 18,
    magicNumber: '11',
    sosRating: '11th Toughest',
    nextGame: {
      opponent: '@ Raiders',
      ifWin: 91,
      ifLoss: 74,
      leverage: 17
    },
    divisionRadar: [
      { team: 'Bills', pct: 62 },
      { team: 'Patriots', pct: 22 },
      { team: 'Dolphins', pct: 11 },
      { team: 'Jets', pct: 5 }
    ],
    seedDistribution: [
      { seed: '#1 Seed', pct: 18 },
      { seed: '#2 Seed', pct: 24 },
      { seed: '#3 Seed', pct: 12 },
      { seed: '#4 Seed', pct: 8 },
      { seed: '#5 Seed', pct: 11 },
      { seed: '#6 Seed', pct: 7 },
      { seed: '#7 Seed', pct: 4 }
    ],
    opponents: [
      { team: 'LA Chargers', pct: 26 },
      { team: 'Pittsburgh Steelers', pct: 19 },
      { team: 'Jacksonville Jaguars', pct: 15 }
    ],
    rootingGuide: [
      { target: "Root for Chargers over Chiefs", why: "Maximizes odds for Buffalo's AFC #1 overall seed & bye week." },
      { target: "Root for Jets over Patriots", why: "Suppresses division chasers in the AFC East standings." },
      { target: "Root for Texans over Jaguars", why: "Creates favorable seeding tiebreaker positioning." }
    ]
  };

  let sabresData = {
    team: 'Buffalo Sabres',
    makePlayoffs: 38,
    winDivision: 11,
    wildcard: 27,
    tragicNumber: 'Cutoff: 92 Pts',
    sosRating: '8th Toughest in East',
    nextGame: {
      opponent: '@ Canadiens',
      ifWin: 44,
      ifLoss: 33,
      leverage: 11
    },
    divisionRadar: [
      { team: 'Panthers', pct: 36 },
      { team: 'Lightning', pct: 28 },
      { team: 'Bruins', pct: 16 },
      { team: 'Sabres', pct: 11 }
    ],
    seedDistribution: [
      { seed: 'Div 1', pct: 11 },
      { seed: 'Div 2', pct: 14 },
      { seed: 'Div 3', pct: 13 },
      { seed: 'Wildcard 1', pct: 16 },
      { seed: 'Wildcard 2', pct: 11 }
    ],
    opponents: [
      { team: 'Florida Panthers', pct: 22 },
      { team: 'Tampa Bay Lightning', pct: 18 },
      { team: 'Toronto Maple Leafs', pct: 14 }
    ],
    rootingGuide: [
      { target: "Regulation Losses for Atlantic Rivals", why: "Ensure games involving BOS, TBL, and FLA do not go to 3-point overtimes." },
      { target: "Western Conference Wins vs. Metro", why: "Protects Eastern Conference Wild Card slot thresholds." }
    ]
  };

  // 1. Bills Standings
  try {
    const html = await fetchHtml(billsUrl);
    const $ = cheerio.load(html);

    $('tr').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Bills') && !text.includes('Schedule') && !text.includes('vs')) {
        const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
        const pcts = cells.map(parseCellPct).filter(n => n >= 0 && n <= 100);
        
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
    console.log('Parsed Bills standings.');
  } catch (err) {
    console.warn('Bills standings fallback used:', err.message);
  }

  // 2. Bills Neutral Rooting Guide
  try {
    const migHtml = await fetchHtml(billsMigUrl);
    const $ = cheerio.load(migHtml);
    const dynamicGuide = [];

    $('tr').each((_, el) => {
      const rowText = $(el).text();
      // Skip any game involving the Bills directly
      if (
        rowText.includes('Wins') && 
        (rowText.includes('vs') || rowText.includes('@')) && 
        !rowText.includes('Bills')
      ) {
        const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
        if (cells.length >= 3) {
          const matchup = cells[0].replace(/\s+/g, ' ');
          const preference = cells.find(c => c.includes('Wins'));
          if (preference && dynamicGuide.length < 3) {
            dynamicGuide.push({
              target: `Root for ${preference.trim()}`,
              why: `Matchup: ${matchup}. Neutral AFC leverage for Buffalo's seeding.`
            });
          }
        }
      }
    });

    if (dynamicGuide.length > 0) {
      billsData.rootingGuide = dynamicGuide;
      console.log(`Parsed ${dynamicGuide.length} neutral rooting matchups.`);
    }
  } catch (err) {
    console.warn('Bills MIG fallback used:', err.message);
  }

  // 3. Sabres Standings
  try {
    const html = await fetchHtml(sabresUrl);
    const $ = cheerio.load(html);

    $('tr').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Sabres') && !text.includes('Schedule') && !text.includes('vs')) {
        const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
        const pcts = cells.map(parseCellPct).filter(n => n >= 0 && n <= 100);
        
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
    console.log('Parsed Sabres standings.');
  } catch (err) {
    console.warn('Sabres standings fallback used:', err.message);
  }

  const finalPayload = {
    updatedAt: new Date().toISOString(),
    source: 'http://www.playoffstatus.com',
    bills: billsData,
    sabres: sabresData
  };

  fs.writeFileSync('./data.json', JSON.stringify(finalPayload, null, 2), 'utf-8');
  console.log('data.json successfully written.');
}

scrapePlayoffStatus();
