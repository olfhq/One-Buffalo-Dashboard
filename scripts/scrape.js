// scripts/scrape.js
const fs = require('fs');
const path = require('path');
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

function calculateLiveNhlWinChance(bufScore, oppScore, statusDetail, preGameProb = 52) {
  const buf = parseInt(bufScore) || 0;
  const opp = parseInt(oppScore) || 0;
  const diff = buf - opp;
  const detail = (statusDetail || '').toLowerCase();

  if (detail.includes('final')) {
    if (diff > 0) return 100;
    if (diff < 0) return 0;
    return 50;
  }

  let minsRemaining = 60;
  if (detail.includes('ot') || detail.includes('overtime') || detail.includes('so') || detail.includes('shootout')) {
    minsRemaining = 2.0;
  } else if (detail.includes('end of 2') || detail.includes('end of the 2')) {
    minsRemaining = 20.0;
  } else if (detail.includes('end of 1') || detail.includes('end of the 1')) {
    minsRemaining = 40.0;
  } else if (detail.includes('3') || detail.includes('3rd')) {
    const match = detail.match(/(\d+):(\d+)/);
    minsRemaining = match ? Math.max(0.1, parseInt(match[1]) + parseInt(match[2]) / 60) : 10;
  } else if (detail.includes('2') || detail.includes('2nd')) {
    const match = detail.match(/(\d+):(\d+)/);
    minsRemaining = match ? Math.max(20.1, 20 + parseInt(match[1]) + parseInt(match[2]) / 60) : 30;
  } else if (detail.includes('1') || detail.includes('1st')) {
    const match = detail.match(/(\d+):(\d+)/);
    minsRemaining = match ? Math.max(40.1, 40 + parseInt(match[1]) + parseInt(match[2]) / 60) : 50;
  }

  if (diff === 0 && minsRemaining <= 1.0) return 50;

  const frac = Math.max(0.005, minsRemaining / 60);
  const p0 = Math.min(0.95, Math.max(0.05, (preGameProb || 52) / 100));
  const baselineLogit = Math.log(p0 / (1 - p0));
  const sigma = Math.sqrt(0.12 * minsRemaining + 0.25);
  const z = (baselineLogit * frac * 0.5) + (diff * 1.55 / sigma);
  const prob = 1 / (1 + Math.exp(-z));

  return Math.min(99, Math.max(1, Math.round(prob * 100)));
}

function calculateLiveNflWinChance(bufScore, oppScore, statusDetail, preGameProb = 60) {
  const buf = parseInt(bufScore) || 0;
  const opp = parseInt(oppScore) || 0;
  const diff = buf - opp;
  const detail = (statusDetail || '').toLowerCase();

  if (detail.includes('final')) {
    if (diff > 0) return 100;
    if (diff < 0) return 0;
    return 50;
  }

  let minsRemaining = 60;
  if (detail.includes('ot') || detail.includes('overtime')) {
    minsRemaining = 5.0;
  } else if (detail.includes('4') || detail.includes('4th')) {
    const match = detail.match(/(\d+):(\d+)/);
    minsRemaining = match ? Math.max(0.2, parseInt(match[1]) + parseInt(match[2]) / 60) : 7.5;
  } else if (detail.includes('3') || detail.includes('3rd')) {
    const match = detail.match(/(\d+):(\d+)/);
    minsRemaining = match ? Math.max(15.2, 15 + parseInt(match[1]) + parseInt(match[2]) / 60) : 22.5;
  } else if (detail.includes('2') || detail.includes('2nd') || detail.includes('half')) {
    minsRemaining = 30;
  } else if (detail.includes('1') || detail.includes('1st')) {
    minsRemaining = 45;
  }

  if (diff === 0 && minsRemaining <= 1.0) return 50;

  const frac = Math.max(0.005, minsRemaining / 60);
  const p0 = Math.min(0.95, Math.max(0.05, (preGameProb || 60) / 100));
  const baselineLogit = Math.log(p0 / (1 - p0));
  const sigma = Math.max(1.5, 13.5 * Math.sqrt(frac));
  const z = (baselineLogit * frac * 0.4) + (diff * 1.6 / sigma);
  const prob = 1 / (1 + Math.exp(-z));

  return Math.min(99, Math.max(1, Math.round(prob * 100)));
}

// Scrape dynamic Bills Playoff Leverage (If Win / If Lose / Swing) from PlayoffStatus.com
async function fetchBillsLeverage(oppShortName, billsCurrentPlayoffPct) {
  const base = billsCurrentPlayoffPct || 79;
  let leverageData = {
    ifWin: Math.min(99, base + 6),
    ifLoss: Math.max(50, base - 10),
    leverage: 16
  };
  leverageData.leverage = leverageData.ifWin - leverageData.ifLoss;

  try {
    const html = await fetchHtml('http://www.playoffstatus.com/nfl/billsmig.html');
    const $ = cheerio.load(html);

    $('tr').each((_, el) => {
      const text = $(el).text();
      const oppRegex = new RegExp(`\\b${oppShortName}\\b`, 'i');
      if (oppRegex.test(text) || (oppShortName === 'Ravens' && text.includes('Baltimore'))) {
        const cells = $(el).find('td').map((_, td) => $(td).text().trim()).get();
        const pcts = cells.map(parseCellPct).filter(n => n >= 0 && n <= 100);

        // billsmig.html presents 8 seed columns for "If Win" (8th is No POs)
        // and 8 seed columns for "If Lose" (16th is No POs) at the end of the row
        if (pcts.length >= 16) {
          const tail = pcts.slice(-16);
          const winNoPo = tail[7];   // 8th percentage in 16-col block is No POs if win
          const lossNoPo = tail[15]; // 16th percentage in 16-col block is No POs if loss
          const winTotal = Math.round(100 - winNoPo);
          const lossTotal = Math.round(100 - lossNoPo);

          if (winTotal >= lossTotal && winTotal > 0) {
            leverageData = {
              ifWin: winTotal,
              ifLoss: lossTotal,
              leverage: Math.abs(winTotal - lossTotal)
            };
          }
        }
      }
    });
  } catch (err) {
    console.warn('Bills MIG leverage scrape fallback:', err.message);
  }
  return leverageData;
}

// Scrape dynamic Sabres Playoff Leverage (If Win / If Lose / Swing) from PlayoffStatus.com
async function fetchSabresLeverage(oppShortName, sabresCurrentPlayoffPct) {
  const base = sabresCurrentPlayoffPct || 42;
  let leverageData = {
    ifWin: Math.min(99, Math.round(base + 6)),
    ifLoss: Math.max(1, Math.round(base - 5)),
    leverage: 11
  };
  leverageData.leverage = Math.abs(leverageData.ifWin - leverageData.ifLoss);

  try {
    const html = await fetchHtml('http://www.playoffstatus.com/nhl/sabresmig.html');
    const $ = cheerio.load(html);

    $('tr').each((_, el) => {
      const text = $(el).text();
      const oppRegex = new RegExp(`\\b${oppShortName}\\b`, 'i');
      if (oppShortName && oppRegex.test(text)) {
        const cells = $(el).find('td').map((_, td) => $(td).text().trim()).get();
        const pcts = cells.map(parseCellPct).filter(n => n >= 0 && n <= 100);

        // sabresmig.html presents 6 columns for "If Win" (Div 1-3, WC 1-2, No POs)
        // and 6 columns for "If Lose" at the end of the row
        if (pcts.length >= 12) {
          const tail = pcts.slice(-12);
          const winNoPo = tail[5];
          const lossNoPo = tail[11];
          const winTotal = Math.round(100 - winNoPo);
          const lossTotal = Math.round(100 - lossNoPo);

          if (winTotal >= lossTotal && winTotal >= base && lossTotal <= base) {
            leverageData = {
              ifWin: winTotal,
              ifLoss: lossTotal,
              leverage: Math.abs(winTotal - lossTotal)
            };
          }
        }
      }
    });
  } catch (err) {
    console.warn('Sabres MIG leverage scrape fallback:', err.message);
  }
  return leverageData;
}

// NFL Stadium, Broadcast, and Window Metadata Helpers
const NFL_STADIUMS = {
  'Bills': { venue: 'Highmark Stadium', city: 'Orchard Park, NY', roof: 'Open-Air Stadium', surface: 'Natural Grass', weather: '46°F, 18mph Wind, 20% PoP' },
  'Dolphins': { venue: 'Hard Rock Stadium', city: 'Miami Gardens, FL', roof: 'Open-Air Stadium', surface: 'Natural Bermuda Grass', weather: '82°F, 9mph Wind, 15% PoP' },
  'Patriots': { venue: 'Gillette Stadium', city: 'Foxborough, MA', roof: 'Open-Air Stadium', surface: 'FieldTurf CORE', weather: '51°F, 11mph Wind, 15% PoP' },
  'Jets': { venue: 'MetLife Stadium', city: 'East Rutherford, NJ', roof: 'Open-Air Stadium', surface: 'FieldTurf CORE', weather: '54°F, 8mph Wind, 10% PoP' },
  'Ravens': { venue: 'M&T Bank Stadium', city: 'Baltimore, MD', roof: 'Open-Air Stadium', surface: 'Natural Bermuda Grass', weather: '58°F, 8mph Wind, 10% PoP' },
  'Bengals': { venue: 'Paycor Stadium', city: 'Cincinnati, OH', roof: 'Open-Air Stadium', surface: 'FieldTurf CORE', weather: '55°F, 10mph Wind, 15% PoP' },
  'Browns': { venue: 'Huntington Bank Field', city: 'Cleveland, OH', roof: 'Open-Air Stadium', surface: 'Natural Kentucky Bluegrass', weather: '48°F, 14mph Wind, 25% PoP' },
  'Steelers': { venue: 'Acrisure Stadium', city: 'Pittsburgh, PA', roof: 'Open-Air Stadium', surface: 'Natural Kentucky Bluegrass', weather: '52°F, 11mph Wind, 20% PoP' },
  'Texans': { venue: 'NRG Stadium', city: 'Houston, TX', roof: 'Retractable Roof (Closed)', surface: 'Hellas Matrix Turf', weather: 'Controlled 72°F Climate' },
  'Colts': { venue: 'Lucas Oil Stadium', city: 'Indianapolis, IN', roof: 'Retractable Roof (Closed)', surface: 'Shaw Momentum Turf', weather: 'Controlled 72°F Climate' },
  'Jaguars': { venue: 'EverBank Stadium', city: 'Jacksonville, FL', roof: 'Open-Air Stadium', surface: 'Natural Bermuda Grass', weather: '74°F, 7mph Wind, 10% PoP' },
  'Titans': { venue: 'Nissan Stadium', city: 'Nashville, TN', roof: 'Open-Air Stadium', surface: 'Matrix Helix Turf', weather: '62°F, 9mph Wind, 10% PoP' },
  'Broncos': { venue: 'Empower Field at Mile High', city: 'Denver, CO', roof: 'Open-Air Stadium', surface: 'Natural Kentucky Bluegrass', weather: '52°F, 9mph Wind, 0% PoP' },
  'Chiefs': { venue: 'GEHA Field at Arrowhead', city: 'Kansas City, MO', roof: 'Open-Air Stadium', surface: 'Natural Bermuda Grass', weather: '59°F, 12mph Wind, 5% PoP' },
  'Raiders': { venue: 'Allegiant Stadium', city: 'Las Vegas, NV', roof: 'Domed Stadium', surface: 'Natural Bermuda Grass Tray', weather: 'Controlled 72°F Climate' },
  'Chargers': { venue: 'SoFi Stadium', city: 'Inglewood, CA', roof: 'Indoor Canopy Stadium', surface: 'Matrix Turf', weather: 'Controlled 70°F Climate' },
  'Cowboys': { venue: 'AT&T Stadium', city: 'Arlington, TX', roof: 'Retractable Roof (Closed)', surface: 'Matrix Turf', weather: 'Controlled 72°F Climate' },
  'Giants': { venue: 'MetLife Stadium', city: 'East Rutherford, NJ', roof: 'Open-Air Stadium', surface: 'FieldTurf CORE', weather: '54°F, 8mph Wind, 10% PoP' },
  'Eagles': { venue: 'Lincoln Financial Field', city: 'Philadelphia, PA', roof: 'Open-Air Stadium', surface: 'Natural Grass (Desso)', weather: '56°F, 10mph Wind, 10% PoP' },
  'Commanders': { venue: 'Northwest Stadium', city: 'Landover, MD', roof: 'Open-Air Stadium', surface: 'Natural Bermuda Grass', weather: '57°F, 9mph Wind, 10% PoP' },
  'Bears': { venue: 'Soldier Field', city: 'Chicago, IL', roof: 'Open-Air Stadium', surface: 'Natural Bermuda Grass', weather: '49°F, 15mph Wind, 20% PoP' },
  'Lions': { venue: 'Ford Field', city: 'Detroit, MI', roof: 'Domed Stadium', surface: 'FieldTurf CORE', weather: 'Controlled 72°F Climate' },
  'Packers': { venue: 'Lambeau Field', city: 'Green Bay, WI', roof: 'Open-Air Stadium', surface: 'Natural Grass (SISGrass)', weather: '41°F, 16mph Wind, 30% PoP' },
  'Vikings': { venue: 'U.S. Bank Stadium', city: 'Minneapolis, MN', roof: 'Domed Stadium', surface: 'Act Global Turf', weather: 'Controlled 72°F Climate' },
  'Falcons': { venue: 'Mercedes-Benz Stadium', city: 'Atlanta, GA', roof: 'Retractable Roof (Closed)', surface: 'FieldTurf CORE', weather: 'Controlled 72°F Climate' },
  'Panthers': { venue: 'Bank of America Stadium', city: 'Charlotte, NC', roof: 'Open-Air Stadium', surface: 'FieldTurf', weather: '66°F, 6mph Wind, 10% PoP' },
  'Saints': { venue: 'Caesars Superdome', city: 'New Orleans, LA', roof: 'Domed Stadium', surface: 'Turf Nation', weather: 'Controlled 72°F Climate' },
  'Buccaneers': { venue: 'Raymond James Stadium', city: 'Tampa, FL', roof: 'Open-Air Stadium', surface: 'Natural Bermuda Grass', weather: '78°F, 6mph Wind, 15% PoP' },
  'Cardinals': { venue: 'State Farm Stadium', city: 'Glendale, AZ', roof: 'Retractable Roof (Closed)', surface: 'Natural Bermuda Grass Tray', weather: 'Controlled 72°F Climate' },
  'Rams': { venue: 'SoFi Stadium', city: 'Inglewood, CA', roof: 'Indoor Canopy Stadium', surface: 'Matrix Turf', weather: 'Controlled 70°F Climate' },
  '49ers': { venue: "Levi's Stadium", city: 'Santa Clara, CA', roof: 'Open-Air Stadium', surface: 'Natural Bermuda Grass', weather: '68°F, 7mph Wind, 0% PoP' },
  'Seahawks': { venue: 'Lumen Field', city: 'Seattle, WA', roof: 'Open-Air Stadium', surface: 'FieldTurf Revolution', weather: '53°F, 12mph Wind, 40% Rain' }
};

function getNflStadium(teamName, compVenue, compWeather) {
  const key = Object.keys(NFL_STADIUMS).find(k => (teamName || '').includes(k));
  const base = key ? NFL_STADIUMS[key] : { venue: compVenue?.fullName || 'NFL Stadium', city: compVenue?.address?.city || '', roof: compVenue?.indoor ? 'Indoor Dome' : 'Open-Air Stadium', surface: 'Natural Grass', weather: '55°F, 10mph Wind, 10% PoP' };

  const venueName = (compVenue?.fullName || base.venue).trim();
  const isNeutralVenue = Boolean(compVenue?.fullName && key && !venueName.toLowerCase().includes(base.venue.split(' ')[0].toLowerCase()));

  let roof = isNeutralVenue ? (compVenue?.indoor ? 'Indoor Stadium' : 'Open-Air Stadium') : base.roof;
  let surface = isNeutralVenue ? 'Natural Grass' : base.surface;
  let weather = isNeutralVenue ? (compVenue?.indoor ? 'Controlled 70°F Climate' : '58°F, 9mph Wind, 15% PoP') : base.weather;

  if (compWeather && compWeather.temperature) {
    const gust = compWeather.gust ? `${compWeather.gust} Wind` : '10mph Wind';
    const pop = compWeather.precipitation ? `${compWeather.precipitation} PoP` : '10% PoP';
    weather = `${compWeather.temperature}°F, ${gust}, ${pop}`;
  }
  const cityParts = [compVenue?.address?.city, compVenue?.address?.state || compVenue?.address?.country].map(s => (s || '').trim()).filter(Boolean);
  const cityName = cityParts.length > 0 ? cityParts.join(', ') : base.city;
  return {
    venue: venueName,
    city: cityName,
    fullVenue: cityName ? `${venueName}, ${cityName}` : venueName,
    roof,
    surface,
    weather
  };
}

function getNflBroadcast(rawNet, homeName, awayName, isoTime, isBillsGame = false) {
  const net = (rawNet || 'CBS').trim().toUpperCase();
  const dt = new Date(isoTime);
  const hour = parseInt(dt.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit' }), 10);
  const matchHash = ((homeName || '').length * 7 + (awayName || '').length * 13 + (homeName || '').charCodeAt(0) || 0);

  if (net.includes('PRIME')) return { network: 'Prime Video', crew: 'Al Michaels, Kirk Herbstreit', tag: 'tv-prime' };
  if (net.includes('NBC') || net.includes('PEACOCK')) return { network: 'NBC', crew: 'Mike Tirico, Cris Collinsworth', tag: 'tv-nbc' };
  if (net.includes('ESPN') || net.includes('ABC')) return { network: net.includes('ABC') ? 'ABC/ESPN' : 'ESPN', crew: 'Joe Buck, Troy Aikman', tag: 'tv-espn' };
  if (net.includes('NFL')) return { network: 'NFL Net', crew: 'Rich Eisen, Kurt Warner', tag: 'tv-nfln' };

  if (net.includes('FOX')) {
    if (hour >= 16 && (homeName.includes('Chiefs') || awayName.includes('Chiefs') || homeName.includes('Cowboys') || homeName.includes('49ers') || homeName.includes('Eagles'))) {
      return { network: 'FOX', crew: 'Kevin Burkhardt, Tom Brady', tag: 'tv-fox' };
    }
    const foxCrews = [
      'Joe Davis, Greg Olsen',
      'Kenny Albert, Jonathan Vilma',
      'Adam Amin, Mark Sanchez',
      'Kevin Kugler, Daryl Johnston',
      'Chris Myers, Mark Schlereth',
      'Kevin Burkhardt, Tom Brady'
    ];
    return { network: 'FOX', crew: foxCrews[matchHash % foxCrews.length], tag: 'tv-fox' };
  }

  if (net.includes('CBS')) {
    if (isBillsGame || (hour >= 16 && (homeName.includes('Chiefs') || awayName.includes('Chiefs') || homeName.includes('Ravens')))) {
      return { network: 'CBS', crew: 'Jim Nantz, Tony Romo', tag: 'tv-cbs' };
    }
    const cbsCrews = [
      'Ian Eagle, Charles Davis',
      'Kevin Harlan, Trent Green',
      'Andrew Catalon, Tiki Barber',
      'Spero Dedes, Adam Archuleta',
      'Tom McCarthy, Jay Feely'
    ];
    return { network: 'CBS', crew: cbsCrews[matchHash % cbsCrews.length], tag: 'tv-cbs' };
  }

  return { network: (rawNet || 'CBS').trim(), crew: 'Regional Broadcast Crew', tag: 'tv-cbs' };
}

function getNflWindow(isoTime) {
  const dt = new Date(isoTime);
  const day = dt.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  const hour = parseInt(dt.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit' }), 10);
  
  if (day === 'Thu') {
    return { key: 'TNF', label: 'Thursday Night Football', badge: 'Prime Video Exclusive', order: 1 };
  }
  if (day === 'Sun') {
    if (hour < 12) return { key: 'INTL', label: 'NFL International Series', badge: 'Morning London / Germany Slate', order: 2 };
    if (hour >= 12 && hour < 16) return { key: 'EARLY', label: 'Sunday 1:00 PM ET Early Window', badge: 'Regional CBS / FOX Lineups', order: 3 };
    if (hour >= 16 && hour < 20) return { key: 'LATE', label: 'Sunday 4:25 PM ET National Window', badge: "America's Game of the Week", order: 4 };
    return { key: 'SNF', label: 'Sunday Night Football', badge: 'NBC / Peacock Marquee', order: 5 };
  }
  if (day === 'Mon') {
    return { key: 'MNF', label: 'Monday Night Football', badge: 'ESPN / ABC Prime Time', order: 6 };
  }
  return { key: 'SPECIAL', label: `${day} Football Window`, badge: 'Marquee Broadcast', order: 7 };
}


function calculateNflOddsProb(comp) {
  const odds = comp?.odds?.[0];
  if (odds?.moneyline) {
    const mlHome = parseFloat(odds.moneyline.home?.close?.odds || odds.moneyline.home?.open?.odds);
    const mlAway = parseFloat(odds.moneyline.away?.close?.odds || odds.moneyline.away?.open?.odds);
    if (!isNaN(mlHome) && !isNaN(mlAway)) {
      const pH = mlHome < 0 ? (-mlHome) / (-mlHome + 100) : 100 / (mlHome + 100);
      const pA = mlAway < 0 ? (-mlAway) / (-mlAway + 100) : 100 / (mlAway + 100);
      const homeProb = Math.min(95, Math.max(5, Math.round((pH / (pH + pA)) * 100)));
      return { homeWinChance: homeProb, awayWinChance: 100 - homeProb };
    }
  }

  if (odds?.spread !== undefined && odds?.spread !== null) {
    const spread = parseFloat(odds.spread);
    if (!isNaN(spread)) {
      const homeProb = Math.min(95, Math.max(5, Math.round((1 / (1 + Math.pow(10, spread / 14))) * 100)));
      return { homeWinChance: homeProb, awayWinChance: 100 - homeProb };
    }
  }

  if (comp?.predictor?.homeTeam?.gameProjection) {
    const homeProj = parseFloat(comp.predictor.homeTeam.gameProjection);
    if (!isNaN(homeProj)) {
      const homeProb = Math.min(95, Math.max(5, Math.round(homeProj)));
      return { homeWinChance: homeProb, awayWinChance: 100 - homeProb };
    }
  }

  // Fallback to record-based estimation (Log5)
  const homeComp = comp?.competitors?.find(c => c.homeAway === 'home');
  const awayComp = comp?.competitors?.find(c => c.homeAway === 'away');
  const homeRec = homeComp?.records?.find(r => r.type === 'total')?.summary;
  const awayRec = awayComp?.records?.find(r => r.type === 'total')?.summary;

  if (homeRec && awayRec) {
    const [hW, hL] = homeRec.split('-').map(Number);
    const [aW, aL] = awayRec.split('-').map(Number);
    if (!isNaN(hW) && !isNaN(hL) && !isNaN(aW) && !isNaN(aL) && (hW + hL > 0) && (aW + aL > 0)) {
      const pHome = (hW + 1) / (hW + hL + 2);
      const pAway = (aW + 1) / (aW + aL + 2);
      const log5 = (pHome - pHome * pAway) / (pHome + pAway - 2 * pHome * pAway);
      const homeProb = Math.min(90, Math.max(10, Math.round((log5 + 0.04) * 100)));
      return { homeWinChance: homeProb, awayWinChance: 100 - homeProb };
    }
  }

  return { homeWinChance: 54, awayWinChance: 46 };
}

function calculateNhlOddsProb(homeName, awayName, standingsMap, comp) {
  const odds = comp?.odds?.[0];
  if (odds?.moneyline) {
    const mlHome = parseFloat(odds.moneyline.home?.close?.odds || odds.moneyline.home?.open?.odds);
    const mlAway = parseFloat(odds.moneyline.away?.close?.odds || odds.moneyline.away?.open?.odds);
    if (!isNaN(mlHome) && !isNaN(mlAway)) {
      const pH = mlHome < 0 ? (-mlHome) / (-mlHome + 100) : 100 / (mlHome + 100);
      const pA = mlAway < 0 ? (-mlAway) / (-mlAway + 100) : 100 / (mlAway + 100);
      const homeProb = Math.min(95, Math.max(5, Math.round((pH / (pH + pA)) * 100)));
      return { homeWinChance: homeProb, awayWinChance: 100 - homeProb };
    }
  }

  let homePct = standingsMap?.get(homeName);
  let awayPct = standingsMap?.get(awayName);

  if (homePct === undefined && standingsMap) {
    for (const [key, val] of standingsMap.entries()) {
      if (homeName.includes(key) || key.includes(homeName)) { homePct = val; break; }
    }
  }
  if (awayPct === undefined && standingsMap) {
    for (const [key, val] of standingsMap.entries()) {
      if (awayName.includes(key) || key.includes(awayName)) { awayPct = val; break; }
    }
  }

  const pH = Math.min(0.90, Math.max(0.10, homePct || 0.50));
  const pA = Math.min(0.90, Math.max(0.10, awayPct || 0.50));
  const log5 = (pH - pH * pA) / (pH + pA - 2 * pH * pA);
  const homeProb = Math.min(88, Math.max(12, Math.round((log5 + 0.035) * 100)));
  return { homeWinChance: homeProb, awayWinChance: 100 - homeProb };
}

// Fetch live out-of-town scoreboard and rooting leverage tags
async function fetchNflScoreboard() {
  const outOfTownGames = [];
  try {
    const [res, standingsRes] = await Promise.all([
      fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'),
      fetch('https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings').catch(() => null)
    ]);
    if (!res.ok) return outOfTownGames;
    const data = await res.json();
    const events = data.events || [];

    const nflStandingsMap = new Map();
    if (standingsRes && standingsRes.ok) {
      try {
        const standData = await standingsRes.json();
        function extractTeams(node) {
          if (node.standings?.entries) {
            node.standings.entries.forEach(entry => {
              const wlt = entry.stats?.find(s => s.name === 'overall')?.displayValue || '';
              const streak = entry.stats?.find(s => s.name === 'streak')?.displayValue || '';
              const recStr = streak ? `${wlt}, ${streak}` : wlt;
              const name = entry.team?.displayName;
              const short = entry.team?.shortDisplayName;
              const tName = entry.team?.name;
              const id = entry.team?.id;
              if (name) nflStandingsMap.set(name.toLowerCase().trim(), recStr);
              if (short) nflStandingsMap.set(short.toLowerCase().trim(), recStr);
              if (tName) nflStandingsMap.set(tName.toLowerCase().trim(), recStr);
              if (id) nflStandingsMap.set(String(id), recStr);
            });
          }
          if (node.children) node.children.forEach(extractTeams);
        }
        extractTeams(standData);
      } catch (err) {
        console.warn('NFL standings extract warning:', err.message);
      }
    }

    function getNflRecordStr(competitor, teamName) {
      const id = competitor?.team?.id ? String(competitor.team.id) : '';
      if (id && nflStandingsMap.has(id)) return nflStandingsMap.get(id);
      const cleanName = (teamName || '').toLowerCase().trim();
      if (nflStandingsMap.has(cleanName)) return nflStandingsMap.get(cleanName);
      for (const [k, v] of nflStandingsMap.entries()) {
        if (cleanName.includes(k) || k.includes(cleanName)) return v;
      }
      const totalRec = competitor?.records?.find(r => r.type === 'total')?.summary;
      return totalRec || '';
    }

    // Ensure we capture both current results and upcoming games
    const currentWeekNum = data.week?.number;
    const allFinished = events.every(e => e.competitions?.[0]?.status?.type?.state === 'post');
    const allUpcoming = events.every(e => e.competitions?.[0]?.status?.type?.state === 'pre');

    let extraEvents = [];
    if (allFinished && currentWeekNum) {
      try {
        const nextWeekRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${currentWeekNum + 1}&seasontype=2`);
        if (nextWeekRes.ok) {
          const nextWeekData = await nextWeekRes.json();
          extraEvents = nextWeekData.events || [];
        }
      } catch (e) {
        console.warn('Next week fetch fallback:', e.message);
      }
    } else if (allUpcoming && currentWeekNum && currentWeekNum > 1) {
      try {
        const prevWeekRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${currentWeekNum - 1}&seasontype=2`);
        if (prevWeekRes.ok) {
          const prevWeekData = await prevWeekRes.json();
          extraEvents = prevWeekData.events || [];
        }
      } catch (e) {
        console.warn('Prev week fetch fallback:', e.message);
      }
    }

    const combinedEvents = [...events, ...extraEvents];
    const afcEastPriority = ['New England Patriots', 'Miami Dolphins', 'New York Jets'];
    const afcConferenceTeams = [
      'Kansas City Chiefs', 'Baltimore Ravens', 'Houston Texans', 'Pittsburgh Steelers',
      'Los Angeles Chargers', 'Denver Broncos', 'Indianapolis Colts', 'Cincinnati Bengals',
      'Jacksonville Jaguars', 'Las Vegas Raiders', 'Cleveland Browns', 'Tennessee Titans'
    ];

    function parseNflStandingMetric(recStr, fallbackIdx = 99) {
      const m = String(recStr || '').match(/(\d+)-(\d+)(?:-(\d+))?/);
      if (!m) return { wins: 0, losses: 0, pct: 0.5 - fallbackIdx * 0.01 };
      const w = parseInt(m[1], 10);
      const l = parseInt(m[2], 10);
      const t = m[3] ? parseInt(m[3], 10) : 0;
      const total = w + l + t;
      return { wins: w, losses: l, pct: total > 0 ? (w + 0.5 * t) / total : 0.5 };
    }

    for (const ev of combinedEvents) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;

      const competitors = comp.competitors || [];
      const home = competitors.find(c => c.homeAway === 'home');
      const away = competitors.find(c => c.homeAway === 'away');

      if (!home || !away) continue;

      const homeName = home.team?.displayName || 'Home Team';
      const awayName = away.team?.displayName || 'Away Team';

      if (homeName.includes('Bills') || awayName.includes('Bills')) continue;

      const homeScore = home.score || '0';
      const awayScore = away.score || '0';
      const statusState = comp.status?.type?.state;
      const statusDetail = comp.status?.type?.shortDetail || 'Scheduled';
      const broadcast = (comp.broadcasts?.[0]?.names?.[0] || 'TV').trim();

      const awayRecordStr = getNflRecordStr(away, awayName);
      const homeRecordStr = getNflRecordStr(home, homeName);
      const awayMetric = parseNflStandingMetric(awayRecordStr, afcEastPriority.indexOf(awayName));
      const homeMetric = parseNflStandingMetric(homeRecordStr, afcEastPriority.indexOf(homeName));

      const d = new Date(ev.date);
      const slot = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }) +
        ' • ' + d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }) + ' ET';

      let verdict = 'NFC MATCHUP';
      let impactClass = 'neutral';
      let target = 'Neutral Matchup';
      let why = 'Non-conference NFC matchup with zero direct AFC tiebreaker leverage.';

      const isAwayEast = afcEastPriority.includes(awayName);
      const isHomeEast = afcEastPriority.includes(homeName);
      const isAwayAfc = isAwayEast || afcConferenceTeams.includes(awayName);
      const isHomeAfc = isHomeEast || afcConferenceTeams.includes(homeName);
      const hasChiefs = awayName === 'Kansas City Chiefs' || homeName === 'Kansas City Chiefs';

      if (isAwayEast && isHomeEast) {
        const awayHigher = awayMetric.pct > homeMetric.pct || (awayMetric.pct === homeMetric.pct && awayMetric.wins > homeMetric.wins);
        const biggerThreat = awayHigher ? awayName : homeName;
        const underdog = biggerThreat === awayName ? homeName : awayName;

        target = `Root for ${underdog}`;
        why = `A ${biggerThreat} loss knocks down the higher-standing AFC East rival in the division race.`;

        if (statusState === 'post') {
          const biggerScore = biggerThreat === awayName ? parseInt(awayScore) : parseInt(homeScore);
          const underScore = underdog === awayName ? parseInt(awayScore) : parseInt(homeScore);

          if (underScore > biggerScore) {
            verdict = 'GOOD FOR BUFFALO';
            impactClass = 'good';
            why = `${underdog} beat ${biggerThreat}, pulling Buffalo further ahead in the division.`;
          } else {
            verdict = 'BAD FOR BUFFALO';
            impactClass = 'bad';
            why = `${biggerThreat} win keeps division pressure on the Bills.`;
          }
        } else {
          verdict = 'AFC EAST WATCH';
          impactClass = 'bad';
        }
      } else if (hasChiefs && (isAwayEast || isHomeEast)) {
        const rival = isAwayEast ? awayName : homeName;
        const rivalMetric = isAwayEast ? awayMetric : homeMetric;
        if (rivalMetric.pct >= 0.45) {
          target = `Root for Kansas City Chiefs`;
          why = `AFC East division title takes precedence: A ${rival} loss widens Buffalo's division lead.`;
        } else {
          target = `Root for ${rival}`;
          why = `With ${rival} buried in the standings, a Chiefs loss directly boosts Buffalo's #1 AFC seed odds.`;
        }

        if (statusState === 'post') {
          const rivalScore = rival === awayName ? parseInt(awayScore) : parseInt(homeScore);
          const kcScore = rival === awayName ? parseInt(homeScore) : parseInt(awayScore);
          const wantedKc = rivalMetric.pct >= 0.45;
          const goodOutcome = wantedKc ? (kcScore > rivalScore) : (rivalScore > kcScore);

          if (goodOutcome) {
            verdict = 'GOOD FOR BUFFALO';
            impactClass = 'good';
            why = wantedKc
              ? `Kansas City defeated ${rival}, protecting Buffalo's lead in the AFC East.`
              : `${rival} upset Kansas City, boosting Buffalo's path to the AFC #1 seed.`;
          } else {
            verdict = 'BAD FOR BUFFALO';
            impactClass = 'bad';
            why = wantedKc
              ? `${rival} won, keeping division pressure on the Bills.`
              : `Kansas City won, maintaining pressure in the AFC #1 seed race.`;
          }
        } else {
          verdict = 'AFC EAST WATCH';
          impactClass = 'bad';
        }
      } else if (isAwayEast || isHomeEast) {
        const rival = isAwayEast ? awayName : homeName;
        const opponent = isAwayEast ? homeName : awayName;

        target = `Root for ${opponent}`;
        why = `${rival} loss suppresses division pressure in the AFC East standings.`;

        if (statusState === 'post') {
          const rivalScore = rival === awayName ? parseInt(awayScore) : parseInt(homeScore);
          const oppScore = rival === awayName ? parseInt(homeScore) : parseInt(awayScore);

          if (rivalScore > oppScore) {
            verdict = 'BAD FOR BUFFALO';
            impactClass = 'bad';
            why = `${rival} win keeps pressure on Buffalo's AFC East lead.`;
          } else {
            verdict = 'GOOD FOR BUFFALO';
            impactClass = 'good';
            why = `${rival} dropped a game, widening Buffalo's division lead.`;
          }
        } else {
          verdict = 'AFC EAST WATCH';
          impactClass = 'bad';
        }
      } else if (isAwayAfc && isHomeAfc) {
        const awayHigher = awayMetric.pct > homeMetric.pct || (awayMetric.pct === homeMetric.pct && awayMetric.wins >= homeMetric.wins);
        const contender = awayHigher ? awayName : homeName;
        const opponent = contender === awayName ? homeName : awayName;

        target = `Root for ${opponent}`;
        why = `A ${contender} loss knocks down the higher-seeded AFC contender in conference tiebreakers.`;
        verdict = 'SEEDING WATCH';
        impactClass = 'good';

        if (statusState === 'post') {
          const contScore = contender === awayName ? parseInt(awayScore) : parseInt(homeScore);
          const oppScore = contender === awayName ? parseInt(homeScore) : parseInt(awayScore);

          if (oppScore > contScore) {
            verdict = 'GOOD FOR BUFFALO';
            impactClass = 'good';
            why = `${opponent} defeated ${contender}, improving Buffalo's AFC seeding cushion.`;
          } else {
            verdict = 'RIVAL WIN';
            impactClass = 'neutral';
            why = `${contender} won, keeping pace in the AFC playoff picture.`;
          }
        }
      } else if (isAwayAfc || isHomeAfc) {
        const afcTeam = isAwayAfc ? awayName : homeName;
        const nfcTeam = isAwayAfc ? homeName : awayName;

        target = `Root for ${nfcTeam}`;
        why = `An NFC win over ${afcTeam} hands an AFC team a loss without adding a win to the AFC standings pool.`;
        verdict = 'SEEDING WATCH';
        impactClass = 'good';

        if (statusState === 'post') {
          const afcScore = afcTeam === awayName ? parseInt(awayScore) : parseInt(homeScore);
          const nfcScore = afcTeam === awayName ? parseInt(homeScore) : parseInt(awayScore);

          if (nfcScore > afcScore) {
            verdict = 'GOOD FOR BUFFALO';
            impactClass = 'good';
            why = `${nfcTeam} defeated ${afcTeam}, knocking an AFC rival down a game in conference standings.`;
          } else {
            verdict = 'RIVAL WIN';
            impactClass = 'neutral';
            why = `${afcTeam} picked up an out-of-conference victory.`;
          }
        }
      }

      const stadium = getNflStadium(homeName, comp.venue, comp.weather);
      const broadcastDetails = getNflBroadcast(broadcast, homeName, awayName, ev.date);
      const windowInfo = getNflWindow(ev.date);

      const nflOdds = calculateNflOddsProb(comp);

      outOfTownGames.push({
        isoTime: ev.date,
        slot,
        broadcast: broadcastDetails.network,
        announcers: broadcastDetails.crew,
        venue: stadium.fullVenue,
        roof: stadium.roof,
        surface: stadium.surface,
        weather: stadium.weather,
        window: windowInfo.key,
        windowLabel: windowInfo.label,
        windowBadge: windowInfo.badge,
        statusState,
        statusDetail,
        awayName,
        awayRecord: awayRecordStr,
        awayScore,
        homeName,
        homeRecord: homeRecordStr,
        homeScore,
        homeWinChance: nflOdds.homeWinChance,
        awayWinChance: nflOdds.awayWinChance,
        verdict,
        impactClass,
        target,
        why
      });
    }

    outOfTownGames.sort((a, b) => new Date(a.isoTime) - new Date(b.isoTime));
  } catch (err) {
    console.warn('NFL Scoreboard scrape fallback:', err.message);
  }

  if (outOfTownGames.length === 0) {
    outOfTownGames.push(
      {
        isoTime: '2026-10-22T00:15:00Z',
        slot: 'Thu, Oct 22 • 8:15 PM ET',
        broadcast: 'Prime Video',
        announcers: 'Al Michaels, Kirk Herbstreit',
        venue: 'SoFi Stadium, Inglewood, CA',
        roof: 'Indoor Canopy Stadium',
        surface: 'Matrix Turf',
        weather: 'Controlled 70°F Climate',
        window: 'TNF',
        windowLabel: 'Thursday Night Football',
        windowBadge: 'Prime Video National Showcase',
        statusState: 'pre',
        statusDetail: 'Thu, Oct 22 • 8:15 PM ET',
        awayName: 'Minnesota Vikings',
        awayRecord: '5-1, L1',
        awayScore: '',
        homeName: 'Los Angeles Rams',
        homeRecord: '2-4, W1',
        homeScore: '',
        homeWinChance: 48,
        awayWinChance: 52,
        verdict: 'NFC MATCHUP',
        impactClass: 'neutral',
        target: 'Cross-Conference Showcase',
        why: 'Non-conference contest with neutral AFC postseason leverage.'
      },
      {
        isoTime: '2026-10-25T17:00:00Z',
        slot: 'Sun, Oct 25 • 1:00 PM ET',
        broadcast: 'CBS',
        announcers: 'Kevin Harlan, Trent Green',
        venue: 'Lucas Oil Stadium, Indianapolis, IN',
        roof: 'Retractable Roof (Closed)',
        surface: 'Shaw Momentum Turf',
        weather: 'Controlled 72°F Climate',
        window: 'SUN_EARLY',
        windowLabel: 'Sunday Early Window',
        windowBadge: 'CBS / FOX Regional Action',
        statusState: 'pre',
        statusDetail: 'Sun, Oct 25 • 1:00 PM ET',
        awayName: 'Miami Dolphins',
        awayRecord: '2-4, L1',
        awayScore: '',
        homeName: 'Indianapolis Colts',
        homeRecord: '4-3, W1',
        homeScore: '',
        homeWinChance: 56,
        awayWinChance: 44,
        verdict: 'DIVISION SUPPRESSION',
        impactClass: 'good',
        target: 'Root for Colts Win',
        why: 'A Miami Dolphins loss widens Buffalo\'s division lead in the AFC East standings.'
      },
      {
        isoTime: '2026-10-25T17:00:00Z',
        slot: 'Sun, Oct 25 • 1:00 PM ET',
        broadcast: 'CBS',
        announcers: 'Ian Eagle, Charles Davis',
        venue: 'Acrisure Stadium, Pittsburgh, PA',
        roof: 'Open-Air Stadium',
        surface: 'Natural Kentucky Bluegrass',
        weather: '52°F, 11mph Wind, 20% PoP',
        window: 'SUN_EARLY',
        windowLabel: 'Sunday Early Window',
        windowBadge: 'CBS / FOX Regional Action',
        statusState: 'pre',
        statusDetail: 'Sun, Oct 25 • 1:00 PM ET',
        awayName: 'New York Jets',
        awayRecord: '2-5, L4',
        awayScore: '',
        homeName: 'Pittsburgh Steelers',
        homeRecord: '5-2, W2',
        homeScore: '',
        homeWinChance: 54,
        awayWinChance: 46,
        verdict: 'AFC EAST WATCH',
        impactClass: 'good',
        target: 'Root for Steelers Win',
        why: 'Keeps New York trailing Buffalo in division win percentage and conference tiebreakers.'
      },
      {
        isoTime: '2026-10-25T20:25:00Z',
        slot: 'Sun, Oct 25 • 4:25 PM ET',
        broadcast: 'CBS',
        announcers: 'Jim Nantz, Tony Romo',
        venue: "Levi's Stadium, Santa Clara, CA",
        roof: 'Open-Air Stadium',
        surface: 'Natural Bermuda Grass',
        weather: '68°F, 7mph Wind, 0% PoP',
        window: 'SUN_LATE',
        windowLabel: 'Sunday Late National Window',
        windowBadge: 'CBS Game of the Week',
        statusState: 'pre',
        statusDetail: 'Sun, Oct 25 • 4:25 PM ET',
        awayName: 'Kansas City Chiefs',
        awayRecord: '6-0, W6',
        awayScore: '',
        homeName: 'San Francisco 49ers',
        homeRecord: '3-4, L1',
        homeScore: '',
        homeWinChance: 51,
        awayWinChance: 49,
        verdict: '#1 SEED LEVERAGE',
        impactClass: 'good',
        target: 'Root for 49ers Win',
        why: 'Chiefs loss directly boosts Buffalo\'s probability for the AFC #1 seed and lone first-round playoff bye.'
      },
      {
        isoTime: '2026-10-26T00:20:00Z',
        slot: 'Sun, Oct 25 • 8:20 PM ET',
        broadcast: 'NBC',
        announcers: 'Mike Tirico, Cris Collinsworth',
        venue: 'Empower Field at Mile High, Denver, CO',
        roof: 'Open-Air Stadium',
        surface: 'Natural Kentucky Bluegrass',
        weather: '52°F, 9mph Wind, 0% PoP',
        window: 'SNF',
        windowLabel: 'Sunday Night Football',
        windowBadge: 'NBC National Primetime',
        statusState: 'pre',
        statusDetail: 'Sun, Oct 25 • 8:20 PM ET',
        awayName: 'Los Angeles Chargers',
        awayRecord: '3-3, L1',
        awayScore: '',
        homeName: 'Denver Broncos',
        homeRecord: '4-3, W1',
        homeScore: '',
        homeWinChance: 46,
        awayWinChance: 54,
        verdict: 'WILD CARD LEVERAGE',
        impactClass: 'warning',
        target: 'Root for Chargers Win',
        why: 'Separates the AFC Wild Card tier and maintains Buffalo\'s buffer in conference standings.'
      },
      {
        isoTime: '2026-10-27T00:15:00Z',
        slot: 'Mon, Oct 26 • 8:15 PM ET',
        broadcast: 'ESPN',
        announcers: 'Joe Buck, Troy Aikman',
        venue: 'Raymond James Stadium, Tampa, FL',
        roof: 'Open-Air Stadium',
        surface: 'Natural Bermuda Grass',
        weather: '78°F, 6mph Wind, 15% PoP',
        window: 'MNF',
        windowLabel: 'Monday Night Football',
        windowBadge: 'ESPN National Primetime',
        statusState: 'pre',
        statusDetail: 'Mon, Oct 26 • 8:15 PM ET',
        awayName: 'Baltimore Ravens',
        awayScore: '',
        homeName: 'Tampa Bay Buccaneers',
        homeScore: '',
        homeWinChance: 47,
        awayWinChance: 53,
        verdict: 'CONFERENCE TIEBREAKER',
        impactClass: 'good',
        target: 'Root for Buccaneers Win',
        why: 'NFC win over an AFC playoff contender suppresses Baltimore in conference record tiebreaker math.'
      }
    );
  }
  return outOfTownGames;
}

// NHL Arena, Broadcast, and Window Metadata Helpers
const NHL_ARENA_DATABASE = [
  { aliases: ['Sabres', 'Buffalo', 'BUF', 'Buffalo Sabres'], venue: 'KeyBank Center', city: 'Buffalo, NY' },
  { aliases: ['Panthers', 'Florida', 'FLA', 'Florida Panthers'], venue: 'Amerant Bank Arena', city: 'Sunrise, FL' },
  { aliases: ['Lightning', 'Tampa Bay', 'Tampa', 'TBL', 'Tampa Bay Lightning'], venue: 'Amalie Arena', city: 'Tampa, FL' },
  { aliases: ['Bruins', 'Boston', 'BOS', 'Boston Bruins'], venue: 'TD Garden', city: 'Boston, MA' },
  { aliases: ['Maple Leafs', 'Leafs', 'Toronto', 'TOR', 'Toronto Maple Leafs'], venue: 'Scotiabank Arena', city: 'Toronto, ON' },
  { aliases: ['Canadiens', 'Montreal', 'Montréal', 'MTL', 'Montreal Canadiens'], venue: 'Bell Centre', city: 'Montreal, QC' },
  { aliases: ['Senators', 'Sens', 'Ottawa', 'OTT', 'Ottawa Senators'], venue: 'Canadian Tire Centre', city: 'Ottawa, ON' },
  { aliases: ['Red Wings', 'Detroit', 'DET', 'Detroit Red Wings'], venue: 'Little Caesars Arena', city: 'Detroit, MI' },
  { aliases: ['Rangers', 'NY Rangers', 'New York Rangers', 'NYR'], venue: 'Madison Square Garden', city: 'New York, NY' },
  { aliases: ['Islanders', 'NY Islanders', 'New York Islanders', 'NYI'], venue: 'UBS Arena', city: 'Elmont, NY' },
  { aliases: ['Devils', 'New Jersey', 'NJD', 'New Jersey Devils'], venue: 'Prudential Center', city: 'Newark, NJ' },
  { aliases: ['Flyers', 'Philadelphia', 'PHI', 'Philadelphia Flyers'], venue: 'Wells Fargo Center', city: 'Philadelphia, PA' },
  { aliases: ['Penguins', 'Pittsburgh', 'PIT', 'Pittsburgh Penguins'], venue: 'PPG Paints Arena', city: 'Pittsburgh, PA' },
  { aliases: ['Capitals', 'Washington', 'WSH', 'Washington Capitals'], venue: 'Capital One Arena', city: 'Washington, DC' },
  { aliases: ['Hurricanes', 'Carolina', 'CAR', 'Carolina Hurricanes'], venue: 'Lenovo Center', city: 'Raleigh, NC' },
  { aliases: ['Blue Jackets', 'Columbus', 'CBJ', 'Columbus Blue Jackets'], venue: 'Nationwide Arena', city: 'Columbus, OH' },
  { aliases: ['Blackhawks', 'Chicago', 'CHI', 'Chicago Blackhawks'], venue: 'United Center', city: 'Chicago, IL' },
  { aliases: ['Avalanche', 'Colorado', 'COL', 'Colorado Avalanche'], venue: 'Ball Arena', city: 'Denver, CO' },
  { aliases: ['Stars', 'Dallas', 'DAL', 'Dallas Stars'], venue: 'American Airlines Center', city: 'Dallas, TX' },
  { aliases: ['Wild', 'Minnesota', 'MIN', 'Minnesota Wild'], venue: 'Xcel Energy Center', city: 'St. Paul, MN' },
  { aliases: ['Predators', 'Nashville', 'NSH', 'Nashville Predators'], venue: 'Bridgestone Arena', city: 'Nashville, TN' },
  { aliases: ['Blues', 'St. Louis', 'Saint Louis', 'STL', 'St. Louis Blues'], venue: 'Enterprise Center', city: 'St. Louis, MO' },
  { aliases: ['Jets', 'Winnipeg', 'WPG', 'Winnipeg Jets'], venue: 'Canada Life Centre', city: 'Winnipeg, MB' },
  { aliases: ['Mammoth', 'Utah Mammoth', 'Utah', 'UTA', 'Utah Hockey Club'], venue: 'Delta Center', city: 'Salt Lake City, UT' },
  { aliases: ['Ducks', 'Anaheim', 'ANA', 'Anaheim Ducks'], venue: 'Honda Center', city: 'Anaheim, CA' },
  { aliases: ['Flames', 'Calgary', 'CGY', 'Calgary Flames'], venue: 'Scotiabank Saddledome', city: 'Calgary, AB' },
  { aliases: ['Oilers', 'Edmonton', 'EDM', 'Edmonton Oilers'], venue: 'Rogers Place', city: 'Edmonton, AB' },
  { aliases: ['Kings', 'Los Angeles', 'LA Kings', 'LAK', 'Los Angeles Kings'], venue: 'Crypto.com Arena', city: 'Los Angeles, CA' },
  { aliases: ['Sharks', 'San Jose', 'SJS', 'San Jose Sharks'], venue: 'SAP Center', city: 'San Jose, CA' },
  { aliases: ['Kraken', 'Seattle', 'SEA', 'Seattle Kraken'], venue: 'Climate Pledge Arena', city: 'Seattle, WA' },
  { aliases: ['Canucks', 'Vancouver', 'VAN', 'Vancouver Canucks'], venue: 'Rogers Arena', city: 'Vancouver, BC' },
  { aliases: ['Golden Knights', 'Vegas', 'VGK', 'Vegas Golden Knights'], venue: 'T-Mobile Arena', city: 'Las Vegas, NV' }
];

const NHL_ARENAS = Object.fromEntries(
  NHL_ARENA_DATABASE.map(item => [item.aliases[0], { venue: item.venue, city: item.city }])
);

function getNhlArena(homeName) {
  if (!homeName) return { venue: 'NHL Arena', city: '' };
  const raw = String(homeName).trim();
  const lower = raw.toLowerCase();

  if (lower.includes('islander') || raw.toUpperCase() === 'NYI') {
    return { venue: 'UBS Arena', city: 'Elmont, NY' };
  }
  if (lower.includes('ranger') || raw.toUpperCase() === 'NYR') {
    return { venue: 'Madison Square Garden', city: 'New York, NY' };
  }

  // 1. Exact match
  let found = NHL_ARENA_DATABASE.find(item =>
    item.aliases.some(alias => lower === alias.toLowerCase())
  );
  if (found) return { venue: found.venue, city: found.city };

  // 2. Contains match (length >= 4)
  found = NHL_ARENA_DATABASE.find(item =>
    item.aliases.some(alias => {
      const a = alias.toLowerCase();
      return a.length >= 4 && lower.includes(a);
    })
  );
  if (found) return { venue: found.venue, city: found.city };

  // 3. Word boundary match for short abbreviations
  const words = raw.toUpperCase().split(/[^A-Z0-9]+/);
  found = NHL_ARENA_DATABASE.find(item =>
    item.aliases.some(alias => alias.length <= 3 && words.includes(alias.toUpperCase()))
  );
  return found ? { venue: found.venue, city: found.city } : { venue: 'NHL Arena', city: '' };
}

function getNhlBroadcast(rawNet, homeName, awayName, isSabresGame = false) {
  const cleanRaw = (rawNet || 'ESPN+').trim();
  const net = cleanRaw.toUpperCase();
  const matchHash = ((homeName || '').length * 7 + (awayName || '').length * 13 + ((homeName || '').charCodeAt(0) || 0));

  if (isSabresGame) {
    if (net.includes('TNT')) return { network: 'TNT', crew: 'Kenny Albert, Eddie Olczyk, Brian Boucher', tag: 'tv-tnt' };
    if (net.includes('ABC') || (net.includes('ESPN') && !net.includes('ESPN+'))) return { network: net.includes('ABC') ? 'ABC' : 'ESPN', crew: 'Sean McDonough, Ray Ferraro', tag: 'tv-espn' };
    return { network: 'MSG-B', crew: 'Dan Dunleavy, Rob Ray', tag: 'tv-msg' };
  }
  if (net.includes('TNT') || net.includes('MAX')) {
    const tntCrews = [
      'Kenny Albert, Eddie Olczyk, Brian Boucher',
      'Brendan Burke, Darren Pang, Jackie Redmond'
    ];
    return { network: 'TNT', crew: tntCrews[matchHash % tntCrews.length], tag: 'tv-tnt' };
  }
  if (net.includes('ABC')) return { network: 'ABC', crew: 'Sean McDonough, Ray Ferraro', tag: 'tv-espn' };
  if (net.includes('ESPN+')) {
    const espnPlusCrews = [
      'Bob Wischusen, Kevin Weekes',
      'John Buccigross, Ryan Callahan',
      'Mike Monaco, A.J. Mleczko',
      'Roxy Bernstein, Cassie Campbell-Pascall',
      'Leah Hextall,Dominic Moore',
      'Regional RSN / ESPN+ Out-of-Market Feed'
    ];
    return { network: 'ESPN+', crew: espnPlusCrews[matchHash % espnPlusCrews.length].replace(',', ', '), tag: 'tv-espn' };
  }
  if (net.includes('ESPN')) return { network: 'ESPN', crew: 'Steve Levy, Ray Ferraro', tag: 'tv-espn' };
  if (net.includes('SN') || net.includes('SPORTSNET')) {
    const snCrews = [
      'Chris Cuthbert, Craig Simpson',
      'John Bartlett, Garry Galley',
      'Rick Ball, Kelly Hrudey'
    ];
    return { network: 'Sportsnet', crew: snCrews[matchHash % snCrews.length], tag: 'tv-sn' };
  }
  if (net.includes('TSN')) {
    const tsnCrews = [
      'Gord Miller, Mike Johnson',
      'Bryan Mudryk, Frankie Corrado'
    ];
    return { network: cleanRaw.includes('TSN') ? cleanRaw : 'TSN', crew: tsnCrews[matchHash % tsnCrews.length], tag: 'tv-tsn' };
  }
  if (net.includes('NESN')) return { network: 'NESN', crew: 'Judd Sirott, Andy Brickley', tag: 'tv-nesn' };
  if (net.includes('MSG')) return { network: cleanRaw, crew: 'Sam Rosen, Joe Micheletti', tag: 'tv-msg' };
  return { network: cleanRaw || 'TV', crew: `${homeName || 'Home'} Regional Broadcast Crew`, tag: 'tv-rsn' };
}

function getNhlWindow(isoTime) {
  const dt = new Date(isoTime);
  const day = dt.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  
  if (day === 'Wed') return { key: 'WED', label: 'Wednesday Night Hockey Showcase', badge: 'TNT / Max / National Slate', order: 1 };
  if (day === 'Thu') return { key: 'THU', label: 'Thursday Prime NHL Slate', badge: 'ESPN+ / RSN Lineups', order: 2 };
  if (day === 'Fri') return { key: 'FRI', label: 'Friday Night NHL Matchups', badge: 'Regional & Streaming Lineup', order: 3 };
  if (day === 'Sat') return { key: 'SAT', label: 'Hockey Night in Canada & Saturday National', badge: 'CBC / Sportsnet / NHL Network', order: 4 };
  if (day === 'Sun') return { key: 'SUN', label: 'Sunday NHL Showcase Slate', badge: 'National & Matinee Window', order: 5 };
  if (day === 'Mon') return { key: 'MON', label: 'Monday Night NHL Action', badge: 'Early Week Matchups', order: 6 };
  return { key: 'TUE', label: 'Tuesday Night NHL Slate', badge: 'Frozen Frenzy / Regional Lineups', order: 7 };
}

// Fetch full weekly out-of-town NHL scoreboard and rooting leverage tags
async function fetchNhlScoreboard() {
  const outOfTownGames = [];
  const rawGamesMap = new Map();

  const atlanticPriority = [
    'Florida Panthers', 'Tampa Bay Lightning', 'Boston Bruins', 'Toronto Maple Leafs',
    'Ottawa Senators', 'Detroit Red Wings', 'Montreal Canadiens'
  ];
  const metroContenders = [
    'Carolina Hurricanes', 'New Jersey Devils', 'New York Rangers', 'New York Islanders',
    'Washington Capitals', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'Columbus Blue Jackets'
  ];

  function normalizeName(name) {
    if (!name) return '';
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  try {
    const now = new Date();
    // Look back 2 days to capture recently completed results for the current weekly cycle
    const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const pastStr = past.toISOString().slice(0, 10);

    const [nowRes, pastRes, espnRes, standingsRes] = await Promise.allSettled([
      fetch('https://api-web.nhle.com/v1/schedule/now'),
      fetch(`https://api-web.nhle.com/v1/schedule/${pastStr}`),
      fetch('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'),
      fetch('https://api-web.nhle.com/v1/standings/now')
    ]);

    const standingsMap = new Map();
    const nhlRecordsMap = new Map();
    if (standingsRes.status === 'fulfilled' && standingsRes.value.ok) {
      try {
        const standingsData = await standingsRes.value.json();
        (standingsData.standings || []).forEach(t => {
          const ptPct = t.pointPctg || (t.points && t.gamesPlayed ? t.points / (t.gamesPlayed * 2) : 0.50);
          if (t.teamName?.default) standingsMap.set(normalizeName(t.teamName.default), ptPct);
          if (t.teamCommonName?.default) standingsMap.set(normalizeName(t.teamCommonName.default), ptPct);
          if (t.teamAbbrev?.default) standingsMap.set(t.teamAbbrev.default, ptPct);

          const rec = `${t.wins}-${t.losses}-${t.otLosses}`;
          const streak = t.streakCode ? `${t.streakCode}${t.streakCount || ''}` : '';
          const recStr = streak ? `${rec}, ${streak}` : rec;
          const full = `${t.placeName?.default || t.teamName?.default || ''} ${t.teamCommonName?.default || ''}`.trim();
          if (full) nhlRecordsMap.set(normalizeName(full).toLowerCase(), recStr);
          if (t.teamCommonName?.default) nhlRecordsMap.set(normalizeName(t.teamCommonName.default).toLowerCase(), recStr);
          if (t.teamName?.default) nhlRecordsMap.set(normalizeName(t.teamName.default).toLowerCase(), recStr);
          if (t.teamAbbrev?.default) nhlRecordsMap.set(t.teamAbbrev.default.toLowerCase(), recStr);
        });
      } catch (err) {
        console.warn('NHL standings map build warning:', err.message);
      }
    }

    function getNhlRecordStr(teamName, comp) {
      const cleanName = normalizeName(teamName || '').toLowerCase().trim();
      if (nhlRecordsMap.has(cleanName)) return nhlRecordsMap.get(cleanName);
      for (const [k, v] of nhlRecordsMap.entries()) {
        if (cleanName.includes(k) || k.includes(cleanName)) return v;
      }
      const totalRec = comp?.records?.[0]?.summary;
      return totalRec || '';
    }

    function processNhlScheduleData(data) {
      if (!data?.gameWeek) return;
      for (const week of data.gameWeek) {
        for (const g of (week.games || [])) {
          const awayRaw = `${g.awayTeam?.placeName?.default || ''} ${g.awayTeam?.commonName?.default || ''}`.trim() || g.awayTeam?.abbrev;
          const homeRaw = `${g.homeTeam?.placeName?.default || ''} ${g.homeTeam?.commonName?.default || ''}`.trim() || g.homeTeam?.abbrev;
          const awayName = normalizeName(awayRaw);
          const homeName = normalizeName(homeRaw);

          if (awayName.includes('Sabres') || homeName.includes('Sabres')) continue;

          const gameDate = g.startTimeUTC ? g.startTimeUTC.slice(0, 10) : week.date;
          const key = `${gameDate}_${g.awayTeam?.abbrev}_${g.homeTeam?.abbrev}`;

          let statusState = 'pre';
          let statusDetail = 'Scheduled';
          const st = g.gameState;
          if (st === 'FINAL' || st === 'OFF') {
            statusState = 'post';
            const isOT = g.periodDescriptor?.periodType === 'OT';
            const isSO = g.periodDescriptor?.periodType === 'SO';
            statusDetail = isSO ? 'Final/SO' : isOT ? 'Final/OT' : 'Final';
          } else if (st === 'LIVE' || st === 'CRIT') {
            statusState = 'in';
            statusDetail = `Period ${g.periodDescriptor?.number || 1}`;
          }

          const tvNet = g.tvBroadcasts?.find(b => b.market === 'N' || b.countryCode === 'US')?.network ||
                        g.tvBroadcasts?.[0]?.network || 'ESPN+';

          const d = new Date(g.startTimeUTC);
          const slot = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }) +
            ' • ' + d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }) + ' ET';

          rawGamesMap.set(key, {
            id: g.id,
            isoTime: g.startTimeUTC,
            slot,
            awayName,
            homeName,
            awayScore: g.awayTeam?.score !== undefined ? String(g.awayTeam.score) : '',
            homeScore: g.homeTeam?.score !== undefined ? String(g.homeTeam.score) : '',
            statusState,
            statusDetail,
            broadcast: tvNet,
            venue: g.venue?.default || ''
          });
        }
      }
    }

    if (pastRes.status === 'fulfilled' && pastRes.value.ok) {
      processNhlScheduleData(await pastRes.value.json());
    }
    if (nowRes.status === 'fulfilled' && nowRes.value.ok) {
      processNhlScheduleData(await nowRes.value.json());
    }

    // Overlay real-time live ESPN status/scores for today's games
    if (espnRes.status === 'fulfilled' && espnRes.value.ok) {
      try {
        const espnData = await espnRes.value.json();
        for (const ev of (espnData.events || [])) {
          const comp = ev.competitions?.[0];
          if (!comp) continue;
          const h = comp.competitors?.find(c => c.homeAway === 'home');
          const a = comp.competitors?.find(c => c.homeAway === 'away');
          if (!h || !a) continue;
          const hName = normalizeName(h.team?.displayName);
          const aName = normalizeName(a.team?.displayName);
          if (hName.includes('Sabres') || aName.includes('Sabres')) continue;

          let found = null;
          for (const [k, g] of rawGamesMap.entries()) {
            if ((g.homeName.includes(hName) || hName.includes(g.homeName)) &&
                (g.awayName.includes(aName) || aName.includes(g.awayName))) {
              found = g;
              break;
            }
          }

          const espnState = comp.status?.type?.state;
          const espnDetail = comp.status?.type?.shortDetail || 'LIVE';
          const espnBroadcast = comp.broadcasts?.[0]?.names?.[0];

          if (found) {
            found.statusState = espnState;
            found.statusDetail = espnDetail;
            found.espnComp = comp;
            if (h.score !== undefined) found.homeScore = String(h.score);
            if (a.score !== undefined) found.awayScore = String(a.score);
            if (espnBroadcast) found.broadcast = espnBroadcast;
          } else {
            const d = new Date(ev.date);
            const slot = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }) +
              ' • ' + d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }) + ' ET';
            rawGamesMap.set(`espn_${ev.id}`, {
              id: ev.id,
              isoTime: ev.date,
              slot,
              awayName,
              homeName: hName,
              awayScore: a.score !== undefined ? String(a.score) : '',
              homeScore: h.score !== undefined ? String(h.score) : '',
              statusState: espnState,
              statusDetail: espnDetail,
              broadcast: espnBroadcast || 'TV',
              venue: comp.venue?.fullName || ''
            });
          }
        }
      } catch (e) {
        console.warn('ESPN scoreboard overlay fallback:', e.message);
      }
    }

    function getNhlStandingPct(teamName, recStr, fallbackIdx = 50) {
      let pct = standingsMap?.get(teamName);
      if (pct === undefined && standingsMap) {
        for (const [key, val] of standingsMap.entries()) {
          if ((teamName || '').includes(key) || key.includes(teamName || '')) {
            pct = val;
            break;
          }
        }
      }
      if (pct !== undefined) return pct;
      const m = String(recStr || '').match(/(\d+)-(\d+)-(\d+)/);
      if (m) {
        const w = parseInt(m[1], 10);
        const l = parseInt(m[2], 10);
        const otl = parseInt(m[3], 10);
        const gp = w + l + otl;
        if (gp > 0) return (w * 2 + otl) / (gp * 2);
      }
      return 0.55 - (fallbackIdx >= 0 ? fallbackIdx * 0.01 : 0);
    }

    // Calculate rooting verdicts and impact analysis for every matchup
    for (const g of rawGamesMap.values()) {
      const { awayName, homeName, awayScore, homeScore, statusState, statusDetail } = g;
      const matchesTeam = (name, list) => list.some(t => (name || '').toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes((name || '').toLowerCase()));
      const isAwayAtlantic = matchesTeam(awayName, atlanticPriority);
      const isHomeAtlantic = matchesTeam(homeName, atlanticPriority);
      const isAwayMetro = matchesTeam(awayName, metroContenders);
      const isHomeMetro = matchesTeam(homeName, metroContenders);
      const isOvertime = statusDetail.includes('OT') || statusDetail.includes('SO');

      // Filter out Western vs Western matchups during regular season (until playoffs)
      const isEastRelevant = isAwayAtlantic || isHomeAtlantic || isAwayMetro || isHomeMetro;
      if (!isEastRelevant) {
        continue;
      }

      const awayRecordStr = getNhlRecordStr(awayName, g.espnComp?.competitors?.find(c => c.homeAway === 'away'));
      const homeRecordStr = getNhlRecordStr(homeName, g.espnComp?.competitors?.find(c => c.homeAway === 'home'));
      const awayPct = getNhlStandingPct(awayName, awayRecordStr, atlanticPriority.indexOf(awayName));
      const homePct = getNhlStandingPct(homeName, homeRecordStr, atlanticPriority.indexOf(homeName));

      let verdict = 'NEUTRAL';
      let impactClass = 'neutral';
      let target = 'Neutral Matchup';
      let why = 'Non-conference or cross-division matchup with minimal Sabres playoff leverage.';

      if (isAwayAtlantic && isHomeAtlantic) {
        const biggerThreat = awayPct >= homePct ? awayName : homeName;
        const underdog = biggerThreat === awayName ? homeName : awayName;

        target = `Root for ${underdog} in Regulation`;
        why = `A regulation loss leaves higher-standing ${biggerThreat} with 0 points in the Atlantic race.`;

        if (statusState === 'post') {
          if (isOvertime) {
            verdict = '3-POINT GAME CONCEDED';
            impactClass = 'warning';
            why = `Overtime handed 3 total points to Atlantic rivals. Neither team walked away empty-handed.`;
          } else {
            const biggerScore = biggerThreat === awayName ? parseInt(awayScore) : parseInt(homeScore);
            const underScore = underdog === awayName ? parseInt(awayScore) : parseInt(homeScore);
            if (underScore > biggerScore) {
              verdict = 'REGULATION LOSS';
              impactClass = 'good';
              why = `${underdog} defeated ${biggerThreat} in regulation, keeping them at 0 points.`;
            } else {
              verdict = 'RIVAL WIN';
              impactClass = 'bad';
              why = `${biggerThreat} won in regulation, collecting 2 points in the division chase.`;
            }
          }
        } else {
          verdict = 'ATLANTIC WATCH';
          impactClass = 'warning';
        }
      } else if (isAwayAtlantic || isHomeAtlantic) {
        const rival = isAwayAtlantic ? awayName : homeName;
        const opponent = isAwayAtlantic ? homeName : awayName;

        target = `Root for ${opponent} in Regulation`;
        why = `A regulation loss leaves ${rival} with 0 standings points in the Atlantic Division.`;

        if (statusState === 'post') {
          const rivalScore = rival === awayName ? parseInt(awayScore) : parseInt(homeScore);
          const oppScore = rival === awayName ? parseInt(homeScore) : parseInt(awayScore);
          const rivalWon = rivalScore > oppScore;

          if (isOvertime) {
            if (rivalWon) {
              verdict = 'BAD: RIVAL OT WIN';
              impactClass = 'bad';
              why = `${rival} collected 2 standings points in overtime.`;
            } else {
              verdict = 'RIVAL STOLE OT POINT';
              impactClass = 'warning';
              why = `${opponent} won in overtime, but ${rival} salvaged a loser point.`;
            }
          } else {
            if (!rivalWon) {
              verdict = 'GOOD FOR BUFFALO';
              impactClass = 'good';
              why = `${opponent} handed ${rival} a regulation loss, keeping them at 0 points.`;
            } else {
              verdict = 'BAD FOR BUFFALO';
              impactClass = 'bad';
              why = `${rival} collected 2 standings points in the Atlantic race.`;
            }
          }
        } else {
          verdict = 'ATLANTIC WATCH';
          impactClass = 'warning';
        }
      } else if (isAwayMetro || isHomeMetro) {
        let metroRival;
        let opponent;
        if (isAwayMetro && isHomeMetro) {
          metroRival = awayPct >= homePct ? awayName : homeName;
          opponent = metroRival === awayName ? homeName : awayName;
        } else {
          metroRival = isAwayMetro ? awayName : homeName;
          opponent = isAwayMetro ? homeName : awayName;
        }

        target = `Root for ${opponent} in Regulation`;
        why = isAwayMetro && isHomeMetro
          ? `A regulation loss for higher-standing ${metroRival} prevents a 3-point overtime game in the Wild Card race.`
          : `Suppresses Eastern Conference Wild Card contenders from stacking points.`;

        if (statusState === 'post') {
          const rivalScore = metroRival === awayName ? parseInt(awayScore) : parseInt(homeScore);
          const oppScore = metroRival === awayName ? parseInt(homeScore) : parseInt(awayScore);
          const rivalWon = rivalScore > oppScore;

          if (isOvertime) {
            if (isAwayMetro && isHomeMetro) {
              verdict = '3-POINT GAME CONCEDED';
              impactClass = 'warning';
              why = `Overtime handed 3 total standings points to Metropolitan Wild Card contenders.`;
            } else if (rivalWon) {
              verdict = 'RIVAL OT WIN';
              impactClass = 'bad';
              why = `${metroRival} picked up 2 points in overtime.`;
            } else {
              verdict = 'WILDCARD OT POINT';
              impactClass = 'warning';
              why = `${opponent} won in overtime, but Wild Card contender ${metroRival} salvaged a point.`;
            }
          } else {
            if (!rivalWon) {
              verdict = 'GOOD FOR BUFFALO';
              impactClass = 'good';
              why = `${metroRival} suffered a regulation loss, freezing their wildcard point total.`;
            } else {
              verdict = 'RIVAL WIN';
              impactClass = 'neutral';
              why = `${metroRival} picked up 2 points in the Eastern playoff race.`;
            }
          }
        } else {
          verdict = 'WILD CARD WATCH';
          impactClass = 'neutral';
        }
      }

      const arena = getNhlArena(homeName);
      const broadcastDetails = getNhlBroadcast(g.broadcast, homeName, awayName, false);
      const windowInfo = getNhlWindow(g.isoTime);

      const nhlOdds = calculateNhlOddsProb(homeName, awayName, standingsMap, g.espnComp);

      outOfTownGames.push({
        isoTime: g.isoTime,
        slot: g.slot,
        broadcast: broadcastDetails.network,
        announcers: broadcastDetails.crew,
        venue: g.venue ? (g.venue.includes(',') ? g.venue : `${g.venue}${arena.city ? `, ${arena.city}` : ''}`.replace(/,\s*$/, '')) : (arena.city ? `${arena.venue}, ${arena.city}` : arena.venue),
        window: windowInfo.key,
        windowLabel: windowInfo.label,
        windowBadge: windowInfo.badge,
        statusState,
        statusDetail,
        awayName,
        awayRecord: awayRecordStr,
        awayScore,
        homeName,
        homeRecord: homeRecordStr,
        homeScore,
        homeWinChance: nhlOdds.homeWinChance,
        awayWinChance: nhlOdds.awayWinChance,
        verdict,
        impactClass,
        target,
        why
      });
    }

    outOfTownGames.sort((a, b) => new Date(a.isoTime) - new Date(b.isoTime));
  } catch (err) {
    console.warn('NHL Scoreboard scrape fallback:', err.message);
  }

  if (outOfTownGames.length === 0) {
    outOfTownGames.push(
      {
        isoTime: '2026-10-20T23:00:00Z',
        slot: 'Tue, Oct 20 • 7:00 PM ET',
        broadcast: 'ESPN+',
        announcers: 'Bob Wischusen, Kevin Weekes',
        venue: 'Amerant Bank Arena, Sunrise, FL',
        window: 'TUE',
        windowLabel: 'Tuesday Night NHL Slate',
        windowBadge: 'Frozen Frenzy / Regional Lineups',
        statusState: 'post',
        statusDetail: 'Final',
        awayName: 'Minnesota Wild',
        awayRecord: '5-0-2, W4',
        awayScore: '4',
        homeName: 'Florida Panthers',
        homeRecord: '4-3-1, L1',
        homeScore: '1',
        homeWinChance: 54,
        awayWinChance: 46,
        verdict: 'GOOD FOR BUFFALO',
        impactClass: 'good',
        target: 'Root for Minnesota Wild',
        why: 'Minnesota Wild handed Florida a regulation loss (0 standings points), slowing down the Atlantic leader.'
      },
      {
        isoTime: '2026-10-20T23:00:00Z',
        slot: 'Tue, Oct 20 • 7:00 PM ET',
        broadcast: 'NESN',
        announcers: 'Judd Sirott, Andy Brickley',
        venue: 'TD Garden, Boston, MA',
        window: 'TUE',
        windowLabel: 'Tuesday Night NHL Slate',
        windowBadge: 'Frozen Frenzy / Regional Lineups',
        statusState: 'post',
        statusDetail: 'Final/OT',
        awayName: 'Tampa Bay Lightning',
        awayRecord: '4-2-0, W1',
        awayScore: '3',
        homeName: 'Boston Bruins',
        homeRecord: '8-2-1, W1',
        homeScore: '2',
        homeWinChance: 52,
        awayWinChance: 48,
        verdict: '3-POINT GAME CONCEDED',
        impactClass: 'warning',
        target: 'Root for Tampa Bay Lightning in Regulation',
        why: 'Overtime awarded 3 total points to Atlantic rivals. Boston earned a point despite the loss.'
      },
      {
        isoTime: '2026-10-20T23:30:00Z',
        slot: 'Tue, Oct 20 • 7:30 PM ET',
        broadcast: 'TSN4',
        announcers: 'Gord Miller, Mike Johnson',
        venue: 'Scotiabank Arena, Toronto, ON',
        window: 'TUE',
        windowLabel: 'Tuesday Night NHL Slate',
        windowBadge: 'Frozen Frenzy / Regional Lineups',
        statusState: 'post',
        statusDetail: 'Final',
        awayName: 'New York Rangers',
        awayRecord: '5-0-1, W4',
        awayScore: '4',
        homeName: 'Toronto Maple Leafs',
        homeRecord: '6-4-2, W3',
        homeScore: '1',
        homeWinChance: 53,
        awayWinChance: 47,
        verdict: 'REGULATION LOSS',
        impactClass: 'good',
        target: 'Root for New York Rangers',
        why: 'Toronto suffered a regulation loss, keeping them from pulling ahead in the Atlantic standings.'
      },
      {
        isoTime: '2026-10-21T23:00:00Z',
        slot: 'Wed, Oct 21 • 7:00 PM ET',
        broadcast: 'TNT',
        announcers: 'Kenny Albert, Eddie Olczyk, Brian Boucher',
        venue: 'UBS Arena, Elmont, NY',
        window: 'WED',
        windowLabel: 'Wednesday Night Hockey Showcase',
        windowBadge: 'TNT / Max National Showcase',
        statusState: 'pre',
        statusDetail: 'Scheduled',
        awayName: 'Detroit Red Wings',
        awayRecord: '4-3-0, W1',
        awayScore: '0',
        homeName: 'New York Islanders',
        homeRecord: '5-3-2, OT1',
        homeScore: '0',
        homeWinChance: 51,
        awayWinChance: 49,
        verdict: 'ATLANTIC WATCH',
        impactClass: 'warning',
        target: 'Root for New York Islanders in Regulation',
        why: 'Detroit regulation loss prevents an Atlantic division rival from collecting points.'
      },
      {
        isoTime: '2026-10-22T23:00:00Z',
        slot: 'Thu, Oct 22 • 7:00 PM ET',
        broadcast: 'ESPN+',
        announcers: 'Bob Wischusen, Kevin Weekes',
        venue: 'TD Garden, Boston, MA',
        window: 'THU',
        windowLabel: 'Thursday Prime NHL Slate',
        windowBadge: 'ESPN+ / Regional Lineups',
        statusState: 'pre',
        statusDetail: 'Scheduled',
        awayName: 'Dallas Stars',
        awayScore: '0',
        homeName: 'Boston Bruins',
        homeScore: '0',
        homeWinChance: 50,
        awayWinChance: 50,
        verdict: 'WEST OVER EAST',
        impactClass: 'good',
        target: 'Root for Dallas Stars in Regulation',
        why: 'Western conference win keeps both standings points out of the Eastern playoff pool.'
      }
    );
  }

  return outOfTownGames;
}

// Dynamic NHL Starting Goaltenders and Injury Database
const NHL_STARTING_GOALIES = {
  'Sabres': { name: 'Ukko-Pekka Luukkonen', gaa: '2.78 GAA, .912 SV%' },
  'Capitals': { name: 'Charlie Lindgren', gaa: '2.67 GAA, .914 SV%' },
  'Washington': { name: 'Charlie Lindgren', gaa: '2.67 GAA, .914 SV%' },
  'WSH': { name: 'Charlie Lindgren', gaa: '2.67 GAA, .914 SV%' },
  'Panthers': { name: 'Sergei Bobrovsky', gaa: '2.45 GAA, .918 SV%' },
  'Florida': { name: 'Sergei Bobrovsky', gaa: '2.45 GAA, .918 SV%' },
  'FLA': { name: 'Sergei Bobrovsky', gaa: '2.45 GAA, .918 SV%' },
  'Lightning': { name: 'Andrei Vasilevskiy', gaa: '2.55 GAA, .915 SV%' },
  'Tampa Bay': { name: 'Andrei Vasilevskiy', gaa: '2.55 GAA, .915 SV%' },
  'TBL': { name: 'Andrei Vasilevskiy', gaa: '2.55 GAA, .915 SV%' },
  'Bruins': { name: 'Jeremy Swayman', gaa: '2.62 GAA, .913 SV%' },
  'Boston': { name: 'Jeremy Swayman', gaa: '2.62 GAA, .913 SV%' },
  'BOS': { name: 'Jeremy Swayman', gaa: '2.62 GAA, .913 SV%' },
  'Maple Leafs': { name: 'Anthony Stolarz', gaa: '2.32 GAA, .924 SV%' },
  'Toronto': { name: 'Anthony Stolarz', gaa: '2.32 GAA, .924 SV%' },
  'TOR': { name: 'Anthony Stolarz', gaa: '2.32 GAA, .924 SV%' },
  'Canadiens': { name: 'Sam Montembeault', gaa: '2.95 GAA, .904 SV%' },
  'Montreal': { name: 'Sam Montembeault', gaa: '2.95 GAA, .904 SV%' },
  'MTL': { name: 'Sam Montembeault', gaa: '2.95 GAA, .904 SV%' },
  'Senators': { name: 'Linus Ullmark', gaa: '2.68 GAA, .912 SV%' },
  'Ottawa': { name: 'Linus Ullmark', gaa: '2.68 GAA, .912 SV%' },
  'OTT': { name: 'Linus Ullmark', gaa: '2.68 GAA, .912 SV%' },
  'Red Wings': { name: 'Cam Talbot', gaa: '2.74 GAA, .910 SV%' },
  'Detroit': { name: 'Cam Talbot', gaa: '2.74 GAA, .910 SV%' },
  'DET': { name: 'Cam Talbot', gaa: '2.74 GAA, .910 SV%' },
  'Rangers': { name: 'Igor Shesterkin', gaa: '2.35 GAA, .926 SV%' },
  'NYR': { name: 'Igor Shesterkin', gaa: '2.35 GAA, .926 SV%' },
  'Islanders': { name: 'Ilya Sorokin', gaa: '2.50 GAA, .916 SV%' },
  'NYI': { name: 'Ilya Sorokin', gaa: '2.50 GAA, .916 SV%' },
  'Devils': { name: 'Jacob Markstrom', gaa: '2.60 GAA, .911 SV%' },
  'NJD': { name: 'Jacob Markstrom', gaa: '2.60 GAA, .911 SV%' },
  'Flyers': { name: 'Samuel Ersson', gaa: '2.98 GAA, .901 SV%' },
  'Philadelphia': { name: 'Samuel Ersson', gaa: '2.98 GAA, .901 SV%' },
  'PHI': { name: 'Samuel Ersson', gaa: '2.98 GAA, .901 SV%' },
  'Penguins': { name: 'Tristan Jarry', gaa: '2.92 GAA, .903 SV%' },
  'Pittsburgh': { name: 'Tristan Jarry', gaa: '2.92 GAA, .903 SV%' },
  'PIT': { name: 'Tristan Jarry', gaa: '2.92 GAA, .903 SV%' },
  'Hurricanes': { name: 'Pyotr Kochetkov', gaa: '2.40 GAA, .915 SV%' },
  'Carolina': { name: 'Pyotr Kochetkov', gaa: '2.40 GAA, .915 SV%' },
  'CAR': { name: 'Pyotr Kochetkov', gaa: '2.40 GAA, .915 SV%' },
  'Blue Jackets': { name: 'Elvis Merzlikins', gaa: '3.10 GAA, .899 SV%' },
  'Columbus': { name: 'Elvis Merzlikins', gaa: '3.10 GAA, .899 SV%' },
  'CBJ': { name: 'Elvis Merzlikins', gaa: '3.10 GAA, .899 SV%' },
  'Stars': { name: 'Jake Oettinger', gaa: '2.28 GAA, .922 SV%' },
  'DAL': { name: 'Jake Oettinger', gaa: '2.28 GAA, .922 SV%' },
  'Avalanche': { name: 'Mackenzie Blackwood', gaa: '2.54 GAA, .914 SV%' },
  'Colorado': { name: 'Mackenzie Blackwood', gaa: '2.54 GAA, .914 SV%' },
  'COL': { name: 'Mackenzie Blackwood', gaa: '2.54 GAA, .914 SV%' },
  'Oilers': { name: 'Stuart Skinner', gaa: '2.62 GAA, .908 SV%' },
  'Edmonton': { name: 'Stuart Skinner', gaa: '2.62 GAA, .908 SV%' },
  'EDM': { name: 'Stuart Skinner', gaa: '2.62 GAA, .908 SV%' },
  'Golden Knights': { name: 'Adin Hill', gaa: '2.50 GAA, .915 SV%' },
  'Vegas': { name: 'Adin Hill', gaa: '2.50 GAA, .915 SV%' },
  'VGK': { name: 'Adin Hill', gaa: '2.50 GAA, .915 SV%' },
  'Mammoth': { name: 'Karel Vejmelka', gaa: '2.64 GAA, .913 SV%' },
  'Utah': { name: 'Karel Vejmelka', gaa: '2.64 GAA, .913 SV%' },
  'UTA': { name: 'Karel Vejmelka', gaa: '2.64 GAA, .913 SV%' },
  'Jets': { name: 'Connor Hellebuyck', gaa: '2.10 GAA, .928 SV%' },
  'Winnipeg': { name: 'Connor Hellebuyck', gaa: '2.10 GAA, .928 SV%' },
  'WPG': { name: 'Connor Hellebuyck', gaa: '2.10 GAA, .928 SV%' },
  'Wild': { name: 'Filip Gustavsson', gaa: '2.25 GAA, .923 SV%' },
  'Minnesota': { name: 'Filip Gustavsson', gaa: '2.25 GAA, .923 SV%' },
  'MIN': { name: 'Filip Gustavsson', gaa: '2.25 GAA, .923 SV%' },
  'Predators': { name: 'Juuse Saros', gaa: '2.68 GAA, .911 SV%' },
  'Nashville': { name: 'Juuse Saros', gaa: '2.68 GAA, .911 SV%' },
  'NSH': { name: 'Juuse Saros', gaa: '2.68 GAA, .911 SV%' },
  'Blues': { name: 'Jordan Binnington', gaa: '2.76 GAA, .909 SV%' },
  'St. Louis': { name: 'Jordan Binnington', gaa: '2.76 GAA, .909 SV%' },
  'STL': { name: 'Jordan Binnington', gaa: '2.76 GAA, .909 SV%' },
  'Blackhawks': { name: 'Petr Mrazek', gaa: '2.98 GAA, .904 SV%' },
  'Chicago': { name: 'Petr Mrazek', gaa: '2.98 GAA, .904 SV%' },
  'CHI': { name: 'Petr Mrazek', gaa: '2.98 GAA, .904 SV%' },
  'Canucks': { name: 'Kevin Lankinen', gaa: '2.52 GAA, .914 SV%' },
  'Vancouver': { name: 'Kevin Lankinen', gaa: '2.52 GAA, .914 SV%' },
  'VAN': { name: 'Kevin Lankinen', gaa: '2.52 GAA, .914 SV%' },
  'Flames': { name: 'Dustin Wolf', gaa: '2.60 GAA, .915 SV%' },
  'Calgary': { name: 'Dustin Wolf', gaa: '2.60 GAA, .915 SV%' },
  'CGY': { name: 'Dustin Wolf', gaa: '2.60 GAA, .915 SV%' },
  'Kings': { name: 'Darcy Kuemper', gaa: '2.48 GAA, .914 SV%' },
  'Los Angeles': { name: 'Darcy Kuemper', gaa: '2.48 GAA, .914 SV%' },
  'LAK': { name: 'Darcy Kuemper', gaa: '2.48 GAA, .914 SV%' },
  'Kraken': { name: 'Joey Daccord', gaa: '2.58 GAA, .913 SV%' },
  'Seattle': { name: 'Joey Daccord', gaa: '2.58 GAA, .913 SV%' },
  'SEA': { name: 'Joey Daccord', gaa: '2.58 GAA, .913 SV%' },
  'Ducks': { name: 'Lukas Dostal', gaa: '2.72 GAA, .916 SV%' },
  'Anaheim': { name: 'Lukas Dostal', gaa: '2.72 GAA, .916 SV%' },
  'ANA': { name: 'Lukas Dostal', gaa: '2.72 GAA, .916 SV%' },
  'Sharks': { name: 'Yaroslav Askarov', gaa: '2.89 GAA, .907 SV%' },
  'San Jose': { name: 'Yaroslav Askarov', gaa: '2.89 GAA, .907 SV%' },
  'SJS': { name: 'Yaroslav Askarov', gaa: '2.89 GAA, .907 SV%' }
};

const ESPN_NHL_TEAM_IDS = {
  'BOS': '1', 'BUF': '2', 'CGY': '3', 'CHI': '4', 'DET': '6', 'CAR': '7', 'EDM': '8', 'DAL': '9',
  'MTL': '10', 'NJD': '11', 'NYI': '12', 'NYR': '13', 'OTT': '14', 'PHI': '15', 'PIT': '16', 'COL': '17',
  'NSH': '18', 'STL': '19', 'VAN': '20', 'TOR': '21', 'LAK': '22', 'WSH': '23', 'SJS': '24', 'ANA': '25',
  'FLA': '26', 'TBL': '27', 'WPG': '28', 'CBJ': '29', 'MIN': '30', 'VGK': '31', 'SEA': '32', 'UTA': '34'
};

async function fetchNhlGameInjuries(oppName, oppAbbrev) {
  const injuries = [];
  const cleanOpp = oppName || 'Opponent';
  const oppKey = Object.keys(NHL_STARTING_GOALIES).find(k => cleanOpp.includes(k) || (oppAbbrev && oppAbbrev.includes(k)));
  const oppGoalie = oppKey ? NHL_STARTING_GOALIES[oppKey] : { name: `${cleanOpp} Starter`, gaa: 'Expected Starter' };

  // Starting Goaltenders Wire
  injuries.push(
    {
      player: 'Ukko-Pekka Luukkonen',
      pos: 'G',
      status: 'Probable',
      injury: 'Expected Starter (2.78 GAA, .912 SV%)',
      team: 'Sabres'
    },
    {
      player: oppGoalie.name,
      pos: 'G',
      status: 'Probable',
      injury: oppGoalie.gaa.includes('GAA') ? `Expected Starter (${oppGoalie.gaa})` : oppGoalie.gaa,
      team: cleanOpp
    }
  );

  const oppId = oppAbbrev ? ESPN_NHL_TEAM_IDS[oppAbbrev] : null;

  try {
    async function fetchNhlTeamInjuries(id, label) {
      if (!id) return [];
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/${id}/injuries`);
        if (!res.ok) return [];
        const data = await res.json();
        const list = data.injuries || data.items || [];
        return list.map(item => ({
          player: item.athlete?.displayName || item.displayName || 'Player',
          pos: item.athlete?.position?.abbreviation || item.position || '',
          status: item.status || item.type || 'Questionable',
          injury: item.details?.type || item.injury || 'Undisclosed',
          team: label
        }));
      } catch {
        return [];
      }
    }

    const [bInj, oInj] = await Promise.all([
      fetchNhlTeamInjuries('2', 'Sabres'),
      fetchNhlTeamInjuries(oppId, cleanOpp)
    ]);

    if (bInj.length > 0 || oInj.length > 0) {
      injuries.push(...bInj, ...oInj);
      return injuries;
    }
  } catch (err) {
    console.warn('NHL dynamic injury fetch fallback:', err.message);
  }

  // Baseline team injuries
  injuries.push(
    { player: 'Zach Benson', pos: 'LW', status: 'Questionable', injury: 'Lower Body', team: 'Sabres' },
    { player: 'Mattias Samuelsson', pos: 'D', status: 'Injured Reserve', injury: 'Lower Body', team: 'Sabres' }
  );

  if (cleanOpp.includes('Washington') || oppAbbrev === 'WSH') {
    injuries.push(
      { player: 'Sonny Milano', pos: 'LW', status: 'Injured Reserve', injury: 'Upper Body', team: cleanOpp },
      { player: 'Jakob Chychrun', pos: 'D', status: 'Questionable', injury: 'Upper Body', team: cleanOpp }
    );
  } else if (cleanOpp.includes('Flyers') || oppAbbrev === 'PHI') {
    injuries.push(
      { player: 'Cam York', pos: 'D', status: 'Injured Reserve', injury: 'Upper Body', team: cleanOpp }
    );
  } else if (cleanOpp.includes('Boston') || oppAbbrev === 'BOS') {
    injuries.push(
      { player: 'Matthew Poitras', pos: 'C', status: 'Questionable', injury: 'Undisclosed', team: cleanOpp }
    );
  } else if (cleanOpp.includes('Florida') || oppAbbrev === 'FLA') {
    injuries.push(
      { player: 'Aleksander Barkov', pos: 'C', status: 'Questionable', injury: 'Lower Body', team: cleanOpp }
    );
  } else {
    injuries.push(
      { player: 'Roster Reserve', pos: 'F', status: 'Questionable', injury: 'Day-to-Day', team: cleanOpp }
    );
  }

  return injuries;
}

// Fetch complete official injuries & inactives from Game Summary or Team feeds
async function fetchGameInjuries(eventId, oppName, oppId) {
  const injuries = [];

  if (eventId) {
    try {
      const sumRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`);
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        const injuryGroups = sumData.injuries || [];
        for (const group of injuryGroups) {
          const teamLabel = (group.team?.abbreviation === 'BUF' || (group.team?.displayName || '').includes('Bills')) ? 'Bills' : oppName;
          for (const inj of (group.injuries || [])) {
            const name = inj.athlete?.displayName || inj.athlete?.shortName || 'Player';
            const pos = inj.athlete?.position?.abbreviation || '';
            const status = inj.status || inj.type || 'Inactive';
            const detail = inj.details?.type || inj.injury || inj.type?.detail || 'Undisclosed';

            injuries.push({
              player: name,
              pos: pos,
              status: status,
              injury: detail,
              team: teamLabel
            });
          }
        }
      }
    } catch (e) {
      console.warn('Game summary injury fetch fallback:', e.message);
    }
  }

  if (injuries.length === 0) {
    async function fetchFromTeam(id, label) {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/injuries`);
        if (!res.ok) return [];
        const data = await res.json();
        const list = data.injuries || data.items || [];
        return list.map(item => ({
          player: item.athlete?.displayName || item.displayName || 'Player',
          pos: item.athlete?.position?.abbreviation || item.position || '',
          status: item.status || item.type || 'Questionable',
          injury: item.details?.type || item.injury || 'Undisclosed',
          team: label
        }));
      } catch {
        return [];
      }
    }

    const [bInj, oInj] = await Promise.all([
      fetchFromTeam('2', 'Bills'),
      fetchFromTeam(oppId || '33', oppName)
    ]);
    injuries.push(...bInj, ...oInj);
  }

  if (injuries.length === 0) {
    return [
      { player: 'Josh Allen', pos: 'QB', status: 'Active', injury: 'Full Practice', team: 'Bills' },
      { player: 'James Cook', pos: 'RB', status: 'Active', injury: 'Toe (Full)', team: 'Bills' },
      { player: 'Matt Milano', pos: 'LB', status: 'Injured Reserve', injury: 'Biceps', team: 'Bills' },
      { player: 'Ed Oliver', pos: 'DT', status: 'Active', injury: 'Hamstring', team: 'Bills' },
      { player: 'Khalil Shakir', pos: 'WR', status: 'Active', injury: 'Ankle', team: 'Bills' },
      { player: 'Lamar Jackson', pos: 'QB', status: 'Active', injury: 'Full Practice', team: oppName || 'Ravens' },
      { player: 'Roquan Smith', pos: 'LB', status: 'Active', injury: 'Full Practice', team: oppName || 'Ravens' },
      { player: 'Derrick Henry', pos: 'RB', status: 'Active', injury: 'Rest', team: oppName || 'Ravens' }
    ];
  }

  return injuries;
}

// Fetch live game schedules, game win chance, ISO timestamps, team records, broadcast networks, and matchup intel
async function fetchNextGameSchedule() {
  let billsSchedule = {
    opponent: 'vs. Ravens',
    oppShortName: 'Ravens',
    oppId: '33',
    oppCity: 'Baltimore',
    gameTime: 'Sun, Nov 1 • 1:00 PM ET',
    isoTime: '2026-11-01T18:00:00Z',
    winChance: 60,
    matchupRecords: 'Bills vs. Ravens',
    broadcast: 'CBS',
    venue: 'Highmark Stadium, Orchard Park',
    restBills: 14,
    restOpp: 7,
    restDiff: 'Bills +7 (Post-Bye Week)',
    efficiency: [
      { metric: 'Points / Game', bills: '28.4 (4th)', opp: '24.5 (10th)' },
      { metric: 'Total Yards / Game', bills: '374.2 (5th)', opp: '360.2 (7th)' },
      { metric: 'Passing Yards / Game', bills: '248.5 (6th)', opp: '215.4 (15th)' },
      { metric: 'Rushing Yards / Game', bills: '125.7 (8th)', opp: '144.8 (3rd)' },
      { metric: '3rd Down Conversion %', bills: '46.8% (3rd)', opp: '41.2% (9th)' },
      { metric: 'Red Zone TD %', bills: '68.2% (4th)', opp: '58.0% (11th)' }
    ],
    turnoverRatio: {
      bills: '+4 (8 Takeaways / 4 Giveaways)',
      opp: '+1 (7 Takeaways / 6 Giveaways)',
      advantage: 'Bills (+3 Differential Margin)'
    },
    injuries: [
      { player: 'Josh Allen', pos: 'QB', status: 'Active', injury: 'Full Practice', team: 'Bills' },
      { player: 'James Cook', pos: 'RB', status: 'Active', injury: 'Toe (Full)', team: 'Bills' },
      { player: 'Matt Milano', pos: 'LB', status: 'Injured Reserve', injury: 'Biceps', team: 'Bills' },
      { player: 'Ed Oliver', pos: 'DT', status: 'Active', injury: 'Hamstring', team: 'Bills' },
      { player: 'Khalil Shakir', pos: 'WR', status: 'Active', injury: 'Ankle', team: 'Bills' },
      { player: 'Lamar Jackson', pos: 'QB', status: 'Active', injury: 'Full Practice', team: 'Ravens' },
      { player: 'Roquan Smith', pos: 'LB', status: 'Active', injury: 'Full Practice', team: 'Ravens' },
      { player: 'Derrick Henry', pos: 'RB', status: 'Active', injury: 'Rest', team: 'Ravens' }
    ]
  };

  let sabresSchedule = {
    opponent: '@ Washington',
    oppShortName: 'Washington',
    gameTime: 'Sat, Oct 24 • 7:00 PM ET',
    isoTime: '2026-10-24T23:00:00Z',
    winChance: 46,
    matchupRecords: 'Sabres (4-4-2, 10 pts, L1) vs. Washington (5-4-0, 10 pts, L1)',
    broadcast: 'MSG-B',
    venue: 'Capital One Arena, Washington, DC',
    restSabres: 2,
    restOpp: 2,
    restDiff: 'Even Rest (Both on 2 Days Rest)',
    specialTeams: {
      sabres: 'PP: 19.5% (17th) | PK: 81.2% (11th)',
      opp: 'PP: 15.6% (26th) | PK: 78.9% (19th)',
      advantage: 'Sabres Special Teams Edge (+6.2% Net Margin)'
    },
    efficiency: [
      { metric: 'Goals / Game', sabres: '3.12 (12th)', opp: '3.30 (10th)' },
      { metric: 'Goals Against / Game', sabres: '3.20 (18th)', opp: '2.90 (12th)' },
      { metric: 'Power Play %', sabres: '19.5% (17th)', opp: '15.6% (26th)' },
      { metric: 'Penalty Kill %', sabres: '81.2% (11th)', opp: '78.9% (19th)' },
      { metric: 'Shots / Game', sabres: '29.8 (15th)', opp: '28.5 (20th)' },
      { metric: 'Faceoff Win %', sabres: '48.2% (22nd)', opp: '49.8% (16th)' }
    ],
    injuries: [
      { player: 'Ukko-Pekka Luukkonen', pos: 'G', status: 'Probable', injury: 'Expected Starter (2.78 GAA, .912 SV%)', team: 'Sabres' },
      { player: 'Charlie Lindgren', pos: 'G', status: 'Probable', injury: 'Expected Starter (2.67 GAA, .914 SV%)', team: 'Washington' },
      { player: 'Zach Benson', pos: 'LW', status: 'Questionable', injury: 'Lower Body', team: 'Sabres' },
      { player: 'Mattias Samuelsson', pos: 'D', status: 'Injured Reserve', injury: 'Lower Body', team: 'Sabres' },
      { player: 'T.J. Oshie', pos: 'RW', status: 'Injured Reserve', injury: 'Back', team: 'Washington' }
    ]
  };

  // 1. Bills (ESPN Schedule + Live Standings API)
  try {
    const [schedRes, standingsRes] = await Promise.all([
      fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/2/schedule'),
      fetch('https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings')
    ]);

    if (schedRes.ok) {
      const data = await schedRes.json();
      const events = data.events || [];
      const nextIdx = events.findIndex(e => e.competitions?.[0]?.status?.type?.state === 'pre' || e.competitions?.[0]?.status?.type?.state === 'in');
      const nextGame = nextIdx !== -1 ? events[nextIdx] : null;
      if (nextGame) {
        const comp = nextGame.competitions[0];
        const bufComp = comp.competitors.find(c => c.id === '2');
        const oppComp = comp.competitors.find(c => c.id !== '2');

        const isHome = bufComp?.homeAway === 'home';
        const oppName = oppComp?.team?.shortDisplayName || 'Opponent';
        const oppCity = oppComp?.team?.location || '';
        const oppId = oppComp?.id || '33';
        const d = new Date(nextGame.date);

        // Compute dynamic Bills rest days from previous game in schedule
        if (nextIdx > 0 && events[nextIdx - 1]?.date) {
          const prevDate = new Date(events[nextIdx - 1].date);
          const diffDays = Math.round((d - prevDate) / (1000 * 60 * 60 * 24));
          if (diffDays > 0 && diffDays <= 21) billsSchedule.restBills = diffDays;
        }
        try {
          const oppSchedRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${oppId}/schedule`);
          if (oppSchedRes.ok) {
            const oppSchedData = await oppSchedRes.json();
            const oppEvents = oppSchedData.events || [];
            const oppNextIdx = oppEvents.findIndex(e => e.id === nextGame.id || Math.abs(new Date(e.date) - d) < 36 * 3600 * 1000);
            if (oppNextIdx > 0 && oppEvents[oppNextIdx - 1]?.date) {
              const oppPrevDate = new Date(oppEvents[oppNextIdx - 1].date);
              const oppDiffDays = Math.round((d - oppPrevDate) / (1000 * 60 * 60 * 24));
              if (oppDiffDays > 0 && oppDiffDays <= 21) billsSchedule.restOpp = oppDiffDays;
            }
          }
        } catch (_) {}

        const restDelta = billsSchedule.restBills - billsSchedule.restOpp;
        if (restDelta > 0) {
          billsSchedule.restDiff = billsSchedule.restBills >= 13
            ? `Bills +${restDelta} (Post-Bye Week)`
            : `Bills +${restDelta} (${billsSchedule.restBills}d vs ${billsSchedule.restOpp}d Rest)`;
        } else if (restDelta < 0) {
          billsSchedule.restDiff = `${oppName} +${Math.abs(restDelta)} (${billsSchedule.restBills}d vs ${billsSchedule.restOpp}d Rest)`;
        } else {
          billsSchedule.restDiff = `Even Rest (Both on ${billsSchedule.restBills} Days Rest)`;
        }

        const dateStr = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
        const tvNetwork = comp.broadcasts?.[0]?.names?.[0] || 'CBS';

        let bufRecord = '';
        let oppRecord = '';
        let bufWins = 5;
        let bufLosses = 1;
        let oppWins = 4;
        let oppLosses = 2;

        if (standingsRes.ok) {
          const standData = await standingsRes.json();
          const allTeams = [];
          function extractTeams(node) {
            if (node.standings?.entries) allTeams.push(...node.standings.entries);
            if (node.children) node.children.forEach(extractTeams);
          }
          extractTeams(standData);

          const getStatVal = (entry, name) => {
            const st = entry?.stats?.find(s => s.name === name);
            return st?.value !== undefined ? parseFloat(st.value) : null;
          };

          const findStats = (id) => {
            const entry = allTeams.find(t => t.team?.id === id);
            if (!entry) return { display: '', w: 0, l: 0, pf: null, pa: null };
            const wlt = entry.stats?.find(s => s.name === 'overall')?.displayValue || '';
            const streak = entry.stats?.find(s => s.name === 'streak')?.displayValue || '';
            const w = parseInt(entry.stats?.find(s => s.name === 'wins')?.value || '0');
            const l = parseInt(entry.stats?.find(s => s.name === 'losses')?.value || '0');
            const pf = getStatVal(entry, 'pointsFor');
            const pa = getStatVal(entry, 'pointsAgainst');
            return { display: streak ? `${wlt}, ${streak}` : wlt, w, l, pf, pa };
          };

          const bufStats = findStats('2');
          const oppStats = findStats(oppId);

          bufRecord = bufStats.display;
          oppRecord = oppStats.display;
          if (bufStats.w + bufStats.l > 0) { bufWins = bufStats.w; bufLosses = bufStats.l; }
          if (oppStats.w + oppStats.l > 0) { oppWins = oppStats.w; oppLosses = oppStats.l; }

          // Dynamically calculate AFC East Magic Number from live division records (Patriots=17, Dolphins=15, Jets=20)
          const eastRivalIds = ['17', '15', '20'];
          const rivalLosses = eastRivalIds
            .map(id => findStats(id))
            .filter(st => st.w + st.l > 0)
            .map(st => st.l);
          if (rivalLosses.length > 0) {
            const minRivalLosses = Math.min(...rivalLosses);
            const magic = Math.max(1, 18 - bufWins - minRivalLosses);
            billsSchedule.magicNumber = String(magic);
          }

          // Dynamically compute Points/Game rank across all 32 NFL teams if pointsFor available
          const ppgList = allTeams
            .map(entry => {
              const w = parseInt(entry.stats?.find(s => s.name === 'wins')?.value || '0');
              const l = parseInt(entry.stats?.find(s => s.name === 'losses')?.value || '0');
              const t = parseInt(entry.stats?.find(s => s.name === 'ties')?.value || '0');
              const pf = getStatVal(entry, 'pointsFor');
              const gp = w + l + t;
              return gp > 0 && pf !== null ? { id: entry.team?.id, ppg: pf / gp } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.ppg - a.ppg);

          const ordinal = (n) => {
            const s = ['th', 'st', 'nd', 'rd'];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
          };

          const bufPpgIdx = ppgList.findIndex(x => x.id === '2');
          const oppPpgIdx = ppgList.findIndex(x => x.id === oppId);
          if (bufPpgIdx !== -1 && oppPpgIdx !== -1 && billsSchedule.efficiency?.[0]) {
            billsSchedule.efficiency[0] = {
              metric: 'Points / Game',
              bills: `${ppgList[bufPpgIdx].ppg.toFixed(1)} (${ordinal(bufPpgIdx + 1)})`,
              opp: `${ppgList[oppPpgIdx].ppg.toFixed(1)} (${ordinal(oppPpgIdx + 1)})`
            };
          }
        }

        const bufDisplay = bufRecord ? `Bills (${bufRecord})` : 'Bills (5-1, W2)';
        const oppDisplay = oppRecord ? `${oppName} (${oppRecord})` : `${oppName} (4-2, L1)`;

        const billsCompStatus = comp.status?.type?.state || 'pre';
        const billsStatusDetail = comp.status?.type?.shortDetail || `${dateStr} • ${timeStr} ET`;
        const billsBufScore = bufComp?.score !== undefined ? String(bufComp.score) : '';
        const billsOppScore = oppComp?.score !== undefined ? String(oppComp.score) : '';

        let winChance = 60;
        if (comp.predictor?.homeTeam) {
          winChance = Math.round(isHome ? comp.predictor.homeTeam.gameProjection : (100 - comp.predictor.homeTeam.gameProjection));
        } else if (billsCompStatus === 'in' || billsCompStatus === 'post') {
          winChance = calculateLiveNflWinChance(billsBufScore, billsOppScore, billsStatusDetail, isHome ? 64 : 56);
        } else {
          const bufPct = bufWins / (bufWins + bufLosses || 1);
          const oppPct = oppWins / (oppWins + oppLosses || 1);
          const homeBonus = isHome ? 0.04 : -0.04;
          winChance = Math.min(88, Math.max(30, Math.round(((bufPct / (bufPct + oppPct || 1)) + homeBonus) * 100)));
        }

        billsSchedule.opponent = `${isHome ? 'vs.' : '@'} ${oppName}`;
        billsSchedule.oppShortName = oppName;
        billsSchedule.oppId = oppId;
        billsSchedule.oppCity = oppCity;
        billsSchedule.gameTime = `${dateStr} • ${timeStr} ET`;
        billsSchedule.isoTime = nextGame.date;
        billsSchedule.winChance = winChance;
        billsSchedule.matchupRecords = `${bufDisplay} vs. ${oppDisplay}`;
        billsSchedule.statusState = billsCompStatus;
        billsSchedule.statusDetail = billsStatusDetail;
        billsSchedule.bufScore = billsBufScore;
        billsSchedule.oppScore = billsOppScore;
        if (billsBufScore !== '' && billsOppScore !== '') {
          billsSchedule.liveScore = isHome ? `Bills ${billsBufScore} - ${billsOppScore} ${oppName}` : `${oppName} ${billsOppScore} - ${billsBufScore} Bills`;
        }
        const billsStadium = getNflStadium(isHome ? 'Buffalo Bills' : oppName, comp.venue, comp.weather);
        const billsBroadcast = getNflBroadcast(tvNetwork, isHome ? 'Buffalo Bills' : oppName, isHome ? oppName : 'Buffalo Bills', nextGame.date, true);
        const billsWindow = getNflWindow(nextGame.date);

        billsSchedule.broadcast = billsBroadcast.network;
        billsSchedule.announcers = billsBroadcast.crew;
        billsSchedule.venue = billsStadium.fullVenue;
        billsSchedule.roof = billsStadium.roof;
        billsSchedule.surface = billsStadium.surface;
        billsSchedule.weather = billsStadium.weather;
        billsSchedule.window = billsWindow.key;
        billsSchedule.windowLabel = billsWindow.label;
        billsSchedule.windowBadge = billsWindow.badge;

        const matchupInjuries = await fetchGameInjuries(nextGame.id, oppName, oppId);
        if (matchupInjuries.length > 0) {
          billsSchedule.injuries = matchupInjuries;
        }
      }
    }
  } catch (err) {
    console.warn('Bills schedule fallback used:', err.message);
  }

  // 2. Sabres (Official NHL API)
  try {
    const [schedRes, standingsRes] = await Promise.all([
      fetch('https://api-web.nhle.com/v1/club-schedule/BUF/week/now'),
      fetch('https://api-web.nhle.com/v1/standings/now')
    ]);

    if (schedRes.ok) {
      const data = await schedRes.json();
      const games = data.games || [];
      const nextIdx = games.findIndex(g => g.gameState === 'LIVE' || g.gameState === 'CRIT' || (g.gameState !== 'FINAL' && g.gameState !== 'OFF' && (new Date(g.startTimeUTC) > new Date(Date.now() - 4 * 3600 * 1000))));
      const nextGame = nextIdx !== -1 ? games[nextIdx] : null;
      if (nextGame) {
        const isHome = nextGame.homeTeam.abbrev === 'BUF';
        const oppAbbrev = isHome ? nextGame.awayTeam.abbrev : nextGame.homeTeam.abbrev;
        const oppName = isHome ? (nextGame.awayTeam.placeName?.default || oppAbbrev) : (nextGame.homeTeam.placeName?.default || oppAbbrev);
        const d = new Date(nextGame.startTimeUTC);

        // Compute dynamic Sabres & Opponent rest days
        if (nextIdx > 0 && games[nextIdx - 1]?.startTimeUTC) {
          const prevDate = new Date(games[nextIdx - 1].startTimeUTC);
          const diffDays = Math.max(1, Math.round((d - prevDate) / (1000 * 60 * 60 * 24)));
          if (diffDays <= 14) sabresSchedule.restSabres = diffDays;
        }
        try {
          const oppSchedRes = await fetch(`https://api-web.nhle.com/v1/club-schedule/${oppAbbrev}/week/now`);
          if (oppSchedRes.ok) {
            const oppSchedData = await oppSchedRes.json();
            const oppGames = oppSchedData.games || [];
            const oppNextIdx = oppGames.findIndex(g => g.id === nextGame.id || Math.abs(new Date(g.startTimeUTC) - d) < 20 * 3600 * 1000);
            if (oppNextIdx > 0 && oppGames[oppNextIdx - 1]?.startTimeUTC) {
              const oppPrevDate = new Date(oppGames[oppNextIdx - 1].startTimeUTC);
              const oppDiffDays = Math.max(1, Math.round((d - oppPrevDate) / (1000 * 60 * 60 * 24)));
              if (oppDiffDays <= 14) sabresSchedule.restOpp = oppDiffDays;
            }
          }
        } catch (_) {}

        const sRestDelta = sabresSchedule.restSabres - sabresSchedule.restOpp;
        if (sRestDelta > 0) {
          sabresSchedule.restDiff = sabresSchedule.restOpp === 1
            ? `Sabres +${sRestDelta} (${oppName} on Back-to-Back)`
            : `Sabres +${sRestDelta} (${sabresSchedule.restSabres}d vs ${sabresSchedule.restOpp}d Rest)`;
        } else if (sRestDelta < 0) {
          sabresSchedule.restDiff = sabresSchedule.restSabres === 1
            ? `${oppName} +${Math.abs(sRestDelta)} (Sabres on Back-to-Back)`
            : `${oppName} +${Math.abs(sRestDelta)} (${sabresSchedule.restSabres}d vs ${sabresSchedule.restOpp}d Rest)`;
        } else {
          sabresSchedule.restDiff = `Even Rest (Both on ${sabresSchedule.restSabres} Days Rest)`;
        }

        const dateStr = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });

        let tvNetwork = 'MSG-B';
        if (Array.isArray(nextGame.tvBroadcasts) && nextGame.tvBroadcasts.length > 0) {
          const homeOrNational = nextGame.tvBroadcasts.find(b => b.market === 'H' || b.market === 'N') || nextGame.tvBroadcasts[0];
          tvNetwork = homeOrNational.network || 'MSG-B';
        }

        let sabresPoints = 10;
        let oppPoints = 0;
        let sabresRecord = '';
        let oppRecord = '';
        let sabresStreak = '';
        let oppStreak = '';

        if (standingsRes.ok) {
          const standingsData = await standingsRes.json();
          const allStandings = standingsData.standings || [];
          const bufStand = allStandings.find(s => s.teamAbbrev?.default === 'BUF');
          const oppStand = allStandings.find(s => s.teamAbbrev?.default === oppAbbrev);

          const ordinal = (n) => {
            const s = ['th', 'st', 'nd', 'rd'];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
          };

          // Dynamically compute Goals / Game and Goals Against / Game rankings across all 32 NHL teams
          const gfList = allStandings
            .filter(s => s.gamesPlayed > 0 && s.goalFor !== undefined)
            .map(s => ({ abbrev: s.teamAbbrev?.default, gpg: s.goalFor / s.gamesPlayed }))
            .sort((a, b) => b.gpg - a.gpg);
          const gaList = allStandings
            .filter(s => s.gamesPlayed > 0 && s.goalAgainst !== undefined)
            .map(s => ({ abbrev: s.teamAbbrev?.default, gapg: s.goalAgainst / s.gamesPlayed }))
            .sort((a, b) => a.gapg - b.gapg);

          const bufGfIdx = gfList.findIndex(x => x.abbrev === 'BUF');
          const oppGfIdx = gfList.findIndex(x => x.abbrev === oppAbbrev);
          if (bufGfIdx !== -1 && oppGfIdx !== -1 && sabresSchedule.efficiency?.[0]) {
            sabresSchedule.efficiency[0] = {
              metric: 'Goals / Game',
              sabres: `${gfList[bufGfIdx].gpg.toFixed(2)} (${ordinal(bufGfIdx + 1)})`,
              opp: `${gfList[oppGfIdx].gpg.toFixed(2)} (${ordinal(oppGfIdx + 1)})`
            };
          }

          const bufGaIdx = gaList.findIndex(x => x.abbrev === 'BUF');
          const oppGaIdx = gaList.findIndex(x => x.abbrev === oppAbbrev);
          if (bufGaIdx !== -1 && oppGaIdx !== -1 && sabresSchedule.efficiency?.[1]) {
            sabresSchedule.efficiency[1] = {
              metric: 'Goals Against / Game',
              sabres: `${gaList[bufGaIdx].gapg.toFixed(2)} (${ordinal(bufGaIdx + 1)})`,
              opp: `${gaList[oppGaIdx].gapg.toFixed(2)} (${ordinal(oppGaIdx + 1)})`
            };
          }

          if (bufStand) {
            sabresPoints = bufStand.points;
            sabresRecord = `${bufStand.wins}-${bufStand.losses}-${bufStand.otLosses}`;
            sabresStreak = bufStand.streakCode ? `${bufStand.streakCode}${bufStand.streakCount || ''}` : '';
            if (bufStand.gamesPlayed && bufStand.gamesPlayed > 0) {
              const projPace = Math.round((sabresPoints / bufStand.gamesPlayed) * 82);
              sabresSchedule.projectedPoints = projPace;
              sabresSchedule.tragicNumber = `${projPace} PTS`;
            }
            if (bufStand.clinchIndicator) {
              const ind = String(bufStand.clinchIndicator).toLowerCase();
              if (['x', 'y', 'p', 'z'].includes(ind)) {
                sabresSchedule.clinched = true;
                sabresSchedule.clinchAlert = { active: true, scenario: 'Buffalo Sabres have clinched an NHL playoff berth.' };
              } else if (ind === 'e') {
                sabresSchedule.eliminated = true;
                sabresSchedule.clinchAlert = { active: true, scenario: 'Buffalo Sabres are eliminated from playoff contention.' };
              }
            }
          }
          if (oppStand) {
            oppPoints = oppStand.points;
            oppRecord = `${oppStand.wins}-${oppStand.losses}-${oppStand.otLosses}`;
            oppStreak = oppStand.streakCode ? `${oppStand.streakCode}${oppStand.streakCount || ''}` : '';
          }
        }

        const bufInfo = sabresStreak ? `Sabres (${sabresRecord}, ${sabresPoints} pts, ${sabresStreak})` : `Sabres (${sabresRecord}, ${sabresPoints} pts)`;
        const oppInfo = oppStreak ? `${oppName} (${oppRecord}, ${oppPoints} pts, ${oppStreak})` : `${oppName} (${oppRecord}, ${oppPoints} pts)`;

        const sArena = getNhlArena(isHome ? 'Buffalo Sabres' : (oppName || oppAbbrev));
        const sBroadcast = getNhlBroadcast(tvNetwork, isHome ? 'Buffalo Sabres' : oppName, isHome ? oppName : 'Buffalo Sabres', true);
        const sWindow = getNhlWindow(nextGame.startTimeUTC);

        const isLive = nextGame.gameState === 'LIVE' || nextGame.gameState === 'CRIT';
        const isPost = nextGame.gameState === 'FINAL' || nextGame.gameState === 'OFF';
        const bufScore = isHome ? nextGame.homeTeam?.score : nextGame.awayTeam?.score;
        const oppScore = isHome ? nextGame.awayTeam?.score : nextGame.homeTeam?.score;
        const statusState = isLive ? 'in' : (isPost ? 'post' : 'pre');
        const periodNum = nextGame.periodDescriptor?.number || 1;
        const periodType = nextGame.periodDescriptor?.periodType || 'REG';
        const statusDetail = isLive ? (periodType === 'OT' ? 'Overtime' : `Period ${periodNum}`) : (isPost ? (periodType === 'OT' ? 'Final/OT' : 'Final') : `${dateStr} • ${timeStr} ET`);

        let sabresWinProb = isHome ? 52 : 46;
        if (isLive || isPost) {
          sabresWinProb = calculateLiveNhlWinChance(bufScore, oppScore, statusDetail, isHome ? 52 : 46);
        }

        const sInjuries = await fetchNhlGameInjuries(oppName, oppAbbrev);

        sabresSchedule = {
          ...sabresSchedule,
          opponent: `${isHome ? 'vs.' : '@'} ${oppName}`,
          oppShortName: oppName,
          gameTime: `${dateStr} • ${timeStr} ET`,
          isoTime: nextGame.startTimeUTC,
          winChance: sabresWinProb,
          matchupRecords: `${bufInfo} vs. ${oppInfo}`,
          statusState,
          statusDetail,
          bufScore: bufScore !== undefined ? String(bufScore) : '',
          oppScore: oppScore !== undefined ? String(oppScore) : '',
          liveScore: (bufScore !== undefined && oppScore !== undefined) ? (isHome ? `Sabres ${bufScore} - ${oppScore} ${oppName}` : `${oppName} ${oppScore} - ${bufScore} Sabres`) : null,
          broadcast: sBroadcast.network,
          announcers: sBroadcast.crew,
          venue: sArena.city ? `${sArena.venue}, ${sArena.city}` : sArena.venue,
          arena: sArena.venue,
          city: sArena.city,
          window: sWindow.key,
          windowLabel: sWindow.label,
          windowBadge: sWindow.badge,
          injuries: sInjuries
        };
      }
    }
  } catch (err) {
    console.warn('Sabres schedule fallback used:', err.message);
  }

  return { billsSchedule, sabresSchedule };
}

async function scrapePlayoffStatus() {
  console.log('Initiating matrix scrape from PlayoffStatus.com and ESPN NFL API...');

  const [{ billsSchedule, sabresSchedule }, outOfTownGames, nhlOutOfTownGames] = await Promise.all([
    fetchNextGameSchedule(),
    fetchNflScoreboard(),
    fetchNhlScoreboard()
  ]);

  const billsUrl = 'http://www.playoffstatus.com/nfl/billsstandings.html';
  const sabresUrl = 'http://www.playoffstatus.com/nhl/sabresstandings.html';
  const billsClinchUrl = 'http://www.playoffstatus.com/nfl/billsclinch.html';
  const sabresClinchUrl = 'http://www.playoffstatus.com/nhl/sabresclinch.html';

  let billsData = {
    team: 'Buffalo Bills',
    makePlayoffs: 79,
    winDivision: 53,
    seed1: 17,
    magicNumber: billsSchedule.magicNumber || '10',
    clinchAlert: { active: false, scenario: 'No clinching scenarios available this week.' },
    nextGame: {
      opponent: billsSchedule.opponent,
      oppShortName: billsSchedule.oppShortName,
      gameTime: billsSchedule.gameTime,
      isoTime: billsSchedule.isoTime || '2026-11-01T18:00:00Z',
      winChance: billsSchedule.winChance,
      matchupRecords: billsSchedule.matchupRecords,
      broadcast: billsSchedule.broadcast,
      venue: billsSchedule.venue,
      statusState: billsSchedule.statusState || 'pre',
      statusDetail: billsSchedule.statusDetail || billsSchedule.gameTime,
      bufScore: billsSchedule.bufScore || '',
      oppScore: billsSchedule.oppScore || '',
      liveScore: billsSchedule.liveScore || null,
      ifWin: 85,
      ifLoss: 69,
      leverage: 16,
      restAdvantage: {
        billsDays: billsSchedule.restBills,
        oppDays: billsSchedule.restOpp,
        summary: billsSchedule.restDiff
      },
      efficiency: billsSchedule.efficiency,
      turnoverRatio: billsSchedule.turnoverRatio,
      injuries: billsSchedule.injuries
    },
    divisionRadar: [
      { team: 'Bills', pct: 53 },
      { team: 'Patriots', pct: 40 },
      { team: 'Jets', pct: 4 },
      { team: 'Dolphins', pct: 3 }
    ],
    seedDistribution: [
      { seed: '#1 Seed', pct: 17 },
      { seed: '#2 Seed', pct: 14 },
      { seed: '#3 Seed', pct: 14 },
      { seed: '#4 Seed', pct: 8 },
      { seed: '#5 Seed', pct: 10 },
      { seed: '#6 Seed', pct: 8 },
      { seed: '#7 Seed', pct: 8 }
    ],
    opponents: [
      { team: 'New England Patriots', pct: 10 },
      { team: 'Denver Broncos', pct: 7 },
      { team: 'Cleveland Browns', pct: 7 }
    ],
    rootingGuide: [
      { target: "Root for Chargers Win", why: "Maximizes odds for Buffalo's AFC #1 overall seed & bye week." },
      { target: "Root for Jets Win", why: "Suppresses division chasers in the AFC East standings." },
      { target: "Root for Texans Win", why: "Creates favorable seeding tiebreaker positioning." }
    ],
    outOfTownGames: outOfTownGames
  };

    let sabresData = {
    team: 'Buffalo Sabres',
    makePlayoffs: 42,
    winDivision: 28,
    wildcard: 14,
    tragicNumber: sabresSchedule.tragicNumber || '91 PTS',
    projectedPoints: sabresSchedule.projectedPoints || 91,
    magicNumber: sabresSchedule.magicNumber || null,
    clinchAlert: sabresSchedule.clinchAlert || { active: false, scenario: 'No clinching scenarios available this week.' },
    nextGame: {
      opponent: sabresSchedule.opponent,
      oppShortName: sabresSchedule.oppShortName || 'Opponent',
      gameTime: sabresSchedule.gameTime,
      isoTime: sabresSchedule.isoTime || '2026-10-24T23:00:00Z',
      winChance: sabresSchedule.winChance || 52,
      matchupRecords: sabresSchedule.matchupRecords,
      broadcast: sabresSchedule.broadcast,
      venue: sabresSchedule.venue || 'KeyBank Center, Buffalo, NY',
      statusState: sabresSchedule.statusState || 'pre',
      statusDetail: sabresSchedule.statusDetail || sabresSchedule.gameTime,
      bufScore: sabresSchedule.bufScore || '',
      oppScore: sabresSchedule.oppScore || '',
      liveScore: sabresSchedule.liveScore || null,
      ifWin: 44,
      ifLoss: 33,
      leverage: 11,
      restAdvantage: {
        sabresDays: sabresSchedule.restSabres || 2,
        oppDays: sabresSchedule.restOpp || 1,
        summary: sabresSchedule.restDiff || 'Sabres +1 (Opp on Back-to-Back)'
      },
      specialTeams: sabresSchedule.specialTeams || {
        sabres: 'PP: 19.5% (17th) | PK: 81.2% (11th)',
        opp: 'PP: 14.2% (29th) | PK: 76.4% (23rd)',
        advantage: 'Sabres Special Teams Edge (+10.1% Net Margin)'
      },
      efficiency: sabresSchedule.efficiency || [
        { metric: 'Goals / Game', sabres: '3.12 (12th)', opp: '2.55 (24th)' },
        { metric: 'Goals Against / Game', sabres: '3.20 (18th)', opp: '3.60 (28th)' },
        { metric: 'Power Play %', sabres: '19.5% (17th)', opp: '14.2% (29th)' },
        { metric: 'Penalty Kill %', sabres: '81.2% (11th)', opp: '76.4% (23rd)' },
        { metric: 'Shots / Game', sabres: '29.8 (15th)', opp: '27.4 (25th)' },
        { metric: 'Faceoff Win %', sabres: '48.2% (22nd)', opp: '49.5% (18th)' }
      ],
      injuries: (Array.isArray(sabresSchedule.injuries) && sabresSchedule.injuries.length > 0)
        ? sabresSchedule.injuries
        : [
            { player: 'Ukko-Pekka Luukkonen', pos: 'G', status: 'Probable', injury: 'Expected Starter (2.78 GAA, .912 SV%)', team: 'Sabres' },
            { player: (NHL_STARTING_GOALIES[sabresSchedule.oppShortName]?.name || `${sabresSchedule.oppShortName || 'Opponent'} Starter`), pos: 'G', status: 'Probable', injury: 'Expected Starter', team: sabresSchedule.oppShortName || 'Opponent' },
            { player: 'Zach Benson', pos: 'LW', status: 'Questionable', injury: 'Lower Body', team: 'Sabres' },
            { player: 'Mattias Samuelsson', pos: 'D', status: 'Injured Reserve', injury: 'Lower Body', team: 'Sabres' }
          ]
    },
    divisionRadar: [
      { team: 'Lightning', pct: 71 },
      { team: 'Bruins', pct: 65 },
      { team: 'Senators', pct: 59 },
      { team: 'Sabres', pct: 42 }
    ],
    seedDistribution: [
      { seed: 'Div 1', pct: 6 },
      { seed: 'Div 2', pct: 10 },
      { seed: 'Div 3', pct: 12 },
      { seed: 'Wildcard 1', pct: 7 },
      { seed: 'Wildcard 2', pct: 7 }
    ],
    opponents: [
      { team: 'Florida Panthers', pct: 24 },
      { team: 'Tampa Bay Lightning', pct: 18 },
      { team: 'Toronto Maple Leafs', pct: 14 }
    ],
    rootingGuide: [
      { target: "Regulation Losses for Atlantic Rivals", why: "Ensure games involving BOS, TBL, and FLA do not go to 3-point overtimes." },
      { target: "Western Conference Wins vs. Metro", why: "Protects Eastern Conference Wild Card slot thresholds." }
    ],
    outOfTownGames: nhlOutOfTownGames
  };

  // 1. Scrape AFC Standings & AFC East Radar
  try {
    const html = await fetchHtml(billsUrl);
    const $ = cheerio.load(html);
    const afcEastTeams = ['Bills', 'Patriots', 'Dolphins', 'Jets'];
    const radarResults = [];

    $('tr').each((_, el) => {
      const firstCell = $(el).find('td').first().text().trim();
      const foundTeam = afcEastTeams.find(t => firstCell === t || firstCell.startsWith(t));

      if (foundTeam) {
        const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
        const pcts = cells.map(parseCellPct).filter(n => n >= 0 && n <= 100);

        if (pcts.length >= 7) {
          const seeds = pcts.slice(-8, -1);
          const winDiv = seeds.slice(0, 4).reduce((a, b) => a + b, 0);

          if (!radarResults.some(r => r.team === foundTeam)) {
            radarResults.push({ team: foundTeam, pct: winDiv });
          }

          if (foundTeam === 'Bills') {
            billsData.seed1 = seeds[0];
            billsData.winDivision = winDiv;
            billsData.makePlayoffs = Math.min(100, Math.round(seeds.reduce((a, b) => a + b, 0)));
            
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
      }
    });

    if (radarResults.length === 4) {
      radarResults.sort((a, b) => (b.pct || 0) - (a.pct || 0));
      billsData.divisionRadar = radarResults;
    }

    // 2. Scrape Table (2) Bills 1st Round Playoff Matchup Probabilities
    const scrapedOpponents = [];
    $('tr').each((_, el) => {
      const firstTd = $(el).find('td').first().text().trim();
      const match = firstTd.match(/^\((\d+)\)\s+([A-Za-z\s]+)$/);
      if (match && !firstTd.includes('Bye') && !firstTd.includes('Elimination')) {
        const rawOpp = match[2].trim();
        const cells = $(el).find('td').map((_, td) => $(td).text().trim()).get();
        // Skip cells[0] so the seed number in "(2) Team" is not parsed as 2%
        const pcts = cells.slice(1).map(parseCellPct).filter(n => n > 0 && n <= 100);
        if (pcts.length > 0) {
          const totalPct = pcts[0];
          scrapedOpponents.push({ team: rawOpp, pct: totalPct });
        }
      }
    });

    if (scrapedOpponents.length >= 3) {
      scrapedOpponents.sort((a, b) => b.pct - a.pct);
      billsData.opponents = scrapedOpponents.slice(0, 3);
    }
  } catch (err) {
    console.warn('Bills standings parse fallback:', err.message);
  }

  // 3. Scrape Opponent Leverage from PlayoffStatus billsmig.html
  const migLeverage = await fetchBillsLeverage(billsSchedule.oppShortName, billsData.makePlayoffs);
  billsData.nextGame.ifWin = migLeverage.ifWin;
  billsData.nextGame.ifLoss = migLeverage.ifLoss;
  billsData.nextGame.leverage = migLeverage.leverage;

  // 4. Bills Clinching Scenarios Scrape
  try {
    const clinchHtml = await fetchHtml(billsClinchUrl);
    const $ = cheerio.load(clinchHtml);
    const scenarios = [];

    $('tr').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Case') && !text.includes('No clinching cases')) {
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (cleaned.length > 10) scenarios.push(cleaned);
      }
    });

    if (scenarios.length > 0) {
      billsData.clinchAlert = { active: true, scenario: scenarios[0] };
    }
  } catch (err) {
    console.warn('Bills clinch check fallback:', err.message);
  }

  // 5. Sabres Clinching Scenarios Scrape
  try {
    const clinchHtml = await fetchHtml(sabresClinchUrl);
    const $ = cheerio.load(clinchHtml);
    const scenarios = [];

    $('tr').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Case') && !text.includes('No clinching cases')) {
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (cleaned.length > 10) scenarios.push(cleaned);
      }
    });

    if (scenarios.length > 0) {
      sabresData.clinchAlert = { active: true, scenario: scenarios[0] };
    }
  } catch (err) {
    console.warn('Sabres clinch check fallback:', err.message);
  }

  // 6. Sabres Standings & Atlantic Radar Scrape
  try {
    const html = await fetchHtml(sabresUrl);
    const $ = cheerio.load(html);
    const atlanticTeams = ['Panthers', 'Lightning', 'Bruins', 'Sabres', 'Maple Leafs', 'Senators', 'Canadiens', 'Red Wings'];
    const sabresRadar = [];

    $('tr').each((_, el) => {
      const firstCell = $(el).find('td').first().text().trim();
      const foundTeam = atlanticTeams.find(t => firstCell === t || firstCell.startsWith(t));

      if (foundTeam) {
        const cells = $(el).find('td').map((_, td) => $(td).text().trim()).get();
        const pcts = cells.map(parseCellPct).filter(n => n >= 0 && n <= 100);
        
        // Probability columns are at the end of the row (Div 1-3, WC 1-2, No POs)
        if (pcts.length >= 6) {
          const seeds = pcts.slice(-6, -1);
          const noPo = pcts[pcts.length - 1];
          const totalPlayoffs = Math.min(100, Math.round(seeds.reduce((a, b) => a + b, 0)));
          const isValidProbRow = (totalPlayoffs + noPo >= 85 && totalPlayoffs + noPo <= 115) || totalPlayoffs >= 10;

          if (isValidProbRow) {
            if (sabresRadar.length < 4 && !sabresRadar.some(r => r.team === foundTeam)) {
              sabresRadar.push({ team: foundTeam.replace('Maple Leafs', 'Leafs'), pct: totalPlayoffs });
            }

            if (foundTeam === 'Sabres') {
              sabresData.winDivision = (seeds[0] || 0) + (seeds[1] || 0) + (seeds[2] || 0);
              sabresData.wildcard = (seeds[3] || 0) + (seeds[4] || 0);
              sabresData.makePlayoffs = totalPlayoffs;

              sabresData.seedDistribution = [
                { seed: 'Div 1', pct: seeds[0] || 0 },
                { seed: 'Div 2', pct: seeds[1] || 0 },
                { seed: 'Div 3', pct: seeds[2] || 0 },
                { seed: 'Wildcard 1', pct: seeds[3] || 0 },
                { seed: 'Wildcard 2', pct: seeds[4] || 0 }
              ];
            }
          }
        }
      }
    });

    if (sabresRadar.length > 0) {
      if (!sabresRadar.some(r => r.team === 'Sabres')) {
        sabresRadar.pop();
        sabresRadar.push({ team: 'Sabres', pct: sabresData.makePlayoffs });
      }
      sabresRadar.sort((a, b) => (b.pct || 0) - (a.pct || 0));
      sabresData.divisionRadar = sabresRadar;
    }
  } catch (err) {
    console.warn('Sabres standings fallback:', err.message);
  }

  // 7. Scrape or dynamically anchor Sabres Opponent Leverage
  const sabresMig = await fetchSabresLeverage(sabresSchedule.oppShortName, sabresData.makePlayoffs);
  sabresData.nextGame.ifWin = sabresMig.ifWin;
  sabresData.nextGame.ifLoss = sabresMig.ifLoss;
  sabresData.nextGame.leverage = sabresMig.leverage;

  const finalPayload = {
    updatedAt: new Date().toISOString(),
    source: 'http://www.playoffstatus.com and ESPN NFL API',
    bills: billsData,
    sabres: sabresData
  };

  const payloadStr = JSON.stringify(finalPayload, null, 2);
  const rootDir = path.resolve(__dirname, '..');
  fs.writeFileSync(path.join(rootDir, 'data.json'), payloadStr, 'utf-8');
  console.log('data.json successfully written with live 1st Round Matchup table.');

  syncHtmlFallbacks(finalPayload);
}

function buildTrimmedFallbackForFile(fileName, fullPayload) {
  if (fileName === 'index.html') {
    const trimSport = (s) => {
      if (!s) return s;
      const { outOfTownGames, ...rest } = s;
      const nextGame = rest.nextGame ? { ...rest.nextGame } : {};
      delete nextGame.efficiency;
      delete nextGame.injuries;
      return { ...rest, nextGame };
    };
    return {
      updatedAt: fullPayload.updatedAt,
      source: fullPayload.source,
      bills: trimSport(fullPayload.bills),
      sabres: trimSport(fullPayload.sabres)
    };
  }
  if (fileName === 'bills.html') {
    return {
      updatedAt: fullPayload.updatedAt,
      source: fullPayload.source,
      bills: fullPayload.bills,
      sabres: {
        team: fullPayload.sabres?.team,
        makePlayoffs: fullPayload.sabres?.makePlayoffs,
        winDivision: fullPayload.sabres?.winDivision,
        wildcard: fullPayload.sabres?.wildcard
      }
    };
  }
  if (fileName === 'sabres.html') {
    return {
      updatedAt: fullPayload.updatedAt,
      source: fullPayload.source,
      bills: {
        team: fullPayload.bills?.team,
        makePlayoffs: fullPayload.bills?.makePlayoffs,
        winDivision: fullPayload.bills?.winDivision,
        seed1: fullPayload.bills?.seed1
      },
      sabres: fullPayload.sabres
    };
  }
  return fullPayload;
}

function syncHtmlFallbacks(fullPayload) {
  const rootDir = path.resolve(__dirname, '..');
  const files = ['index.html', 'bills.html', 'sabres.html'].map(f => path.join(rootDir, f));
  const startMarker = 'const FALLBACK_DATA =';
  const endMarker = 'try {';

  files.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;
    try {
      const baseName = path.basename(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const startIdx = content.indexOf(startMarker);
      const endIdx = content.indexOf(endMarker, startIdx);

      if (startIdx !== -1 && endIdx !== -1) {
        const trimmedPayload = buildTrimmedFallbackForFile(baseName, fullPayload);
        const dataStr = JSON.stringify(trimmedPayload, null, 2);
        const newFallback = `const FALLBACK_DATA = ${dataStr};\n\n      `;
        const updatedContent = content.slice(0, startIdx) + newFallback + content.slice(endIdx);
        fs.writeFileSync(filePath, updatedContent, 'utf8');
        console.log(`Synced FALLBACK_DATA in ${baseName}`);
      } else {
        console.warn(`Could not find FALLBACK_DATA markers in ${baseName}`);
      }
    } catch (err) {
      console.warn(`Failed to sync fallback in ${path.basename(filePath)}:`, err.message);
    }
  });
}

if (require.main === module) {
  scrapePlayoffStatus();
}

module.exports = {
  scrapePlayoffStatus,
  syncHtmlFallbacks,
  buildTrimmedFallbackForFile
};
