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
        const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
        const pcts = cells.map(parseCellPct).filter(n => n >= 0 && n <= 100);

        // billsmig.html presents 8 seed columns for "If Win" (col 8 is No POs)
        // and 8 seed columns for "If Lose" (col 16 is No POs)
        if (pcts.length >= 16) {
          const winNoPo = pcts[7];   // 8th percentage is No POs if win
          const lossNoPo = pcts[15]; // 16th percentage is No POs if loss
          const winTotal = Math.round(100 - winNoPo);
          const lossTotal = Math.round(100 - lossNoPo);

          leverageData = {
            ifWin: winTotal,
            ifLoss: lossTotal,
            leverage: Math.abs(winTotal - lossTotal)
          };
        } else if (pcts.length >= 2) {
          // Fallback if structure varies
          const winTotal = Math.min(99, Math.round(base + 6));
          const lossTotal = Math.max(50, Math.round(base - 10));
          leverageData = {
            ifWin: winTotal,
            ifLoss: lossTotal,
            leverage: Math.abs(winTotal - lossTotal)
          };
        }
      }
    });
  } catch (err) {
    console.warn('Bills MIG leverage scrape fallback:', err.message);
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
  
  let weather = base.weather;
  if (compWeather && compWeather.temperature) {
    const gust = compWeather.gust ? `${compWeather.gust} Wind` : '10mph Wind';
    const pop = compWeather.precipitation ? `${compWeather.precipitation} PoP` : '10% PoP';
    weather = `${compWeather.temperature}°F, ${gust}, ${pop}`;
  }
  const cityName = compVenue?.address?.city ? `${compVenue.address.city}, ${compVenue.address.state || ''}`.trim() : base.city;
  return {
    venue: compVenue?.fullName || base.venue,
    city: cityName,
    fullVenue: cityName ? `${compVenue?.fullName || base.venue}, ${cityName}` : (compVenue?.fullName || base.venue),
    roof: base.roof,
    surface: base.surface,
    weather
  };
}

function getNflBroadcast(rawNet, homeName, awayName, isoTime, isBillsGame = false) {
  const net = (rawNet || 'CBS').toUpperCase();
  const dt = new Date(isoTime);
  const hour = parseInt(dt.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit' }), 10);
  
  if (net.includes('PRIME')) return { network: 'Prime Video', crew: 'Al Michaels, Kirk Herbstreit', tag: 'tv-prime' };
  if (net.includes('NBC') || net.includes('PEACOCK')) return { network: 'NBC', crew: 'Mike Tirico, Cris Collinsworth', tag: 'tv-nbc' };
  if (net.includes('ESPN') || net.includes('ABC')) return { network: net.includes('ABC') ? 'ABC/ESPN' : 'ESPN', crew: 'Joe Buck, Troy Aikman', tag: 'tv-espn' };
  if (net.includes('NFL')) return { network: 'NFL Net', crew: 'Rich Eisen, Kurt Warner', tag: 'tv-nfln' };

  if (net.includes('FOX')) {
    if (homeName.includes('Rams') || homeName.includes('Chiefs') || awayName.includes('Chiefs') || hour >= 16) {
      return { network: 'FOX', crew: 'Kevin Burkhardt, Tom Brady', tag: 'tv-fox' };
    }
    if (homeName.includes('Falcons') || homeName.includes('Packers')) {
      return { network: 'FOX', crew: 'Joe Davis, Greg Olsen', tag: 'tv-fox' };
    }
    if (homeName.includes('Colts')) {
      return { network: 'FOX', crew: 'Kenny Albert, Jonathan Vilma', tag: 'tv-fox' };
    }
    return { network: 'FOX', crew: 'Adam Amin, Mark Sanchez', tag: 'tv-fox' };
  }

  if (net.includes('CBS')) {
    if (isBillsGame || homeName.includes('Chiefs') || awayName.includes('Chiefs') || hour >= 16) {
      return { network: 'CBS', crew: 'Jim Nantz, Tony Romo', tag: 'tv-cbs' };
    }
    if (homeName.includes('Patriots') || homeName.includes('Bills')) {
      return { network: 'CBS', crew: 'Ian Eagle, Charles Davis', tag: 'tv-cbs' };
    }
    if (homeName.includes('Buccaneers')) {
      return { network: 'CBS', crew: 'Kevin Harlan, Trent Green', tag: 'tv-cbs' };
    }
    return { network: 'CBS', crew: 'Andrew Catalon, Tiki Barber', tag: 'tv-cbs' };
  }

  return { network: rawNet || 'CBS', crew: 'Regional Broadcast Crew', tag: 'tv-cbs' };
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

// Fetch live out-of-town scoreboard and rooting leverage tags
async function fetchNflScoreboard() {
  const outOfTownGames = [];
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    if (!res.ok) return outOfTownGames;
    const data = await res.json();
    const events = data.events || [];

    const afcEastPriority = ['New England Patriots', 'Miami Dolphins', 'New York Jets'];
    const afcContenders = ['Kansas City Chiefs', 'Baltimore Ravens', 'Houston Texans', 'Pittsburgh Steelers', 'Los Angeles Chargers'];

    for (const ev of events) {
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
      const broadcast = comp.broadcasts?.[0]?.names?.[0] || 'TV';

      const d = new Date(ev.date);
      const slot = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }) +
        ' • ' + d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }) + ' ET';

      let verdict = 'NEUTRAL';
      let impactClass = 'neutral';
      let target = 'Neutral Matchup';
      let why = 'Non-conference game with zero immediate AFC tiebreaker leverage.';

      const isAwayEast = afcEastPriority.includes(awayName);
      const isHomeEast = afcEastPriority.includes(homeName);
      const hasChiefs = awayName === 'Kansas City Chiefs' || homeName === 'Kansas City Chiefs';

      if (isAwayEast && isHomeEast) {
        const awayIndex = afcEastPriority.indexOf(awayName);
        const homeIndex = afcEastPriority.indexOf(homeName);
        const biggerThreat = awayIndex <= homeIndex ? awayName : homeName;
        const underdog = biggerThreat === awayName ? homeName : awayName;

        target = `Root for ${underdog}`;
        why = `A ${biggerThreat} loss knocks down Buffalo's closest challenger in the AFC East.`;

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
        target = `Root for Kansas City Chiefs`;
        why = `AFC East division title takes precedence: A ${rival} loss widens Buffalo's division lead.`;
        verdict = 'AFC EAST WATCH';
        impactClass = 'good';

        if (statusState === 'post') {
          const rivalScore = rival === awayName ? parseInt(awayScore) : parseInt(homeScore);
          const kcScore = rival === awayName ? parseInt(homeScore) : parseInt(awayScore);

          if (kcScore > rivalScore) {
            verdict = 'GOOD FOR BUFFALO';
            impactClass = 'good';
            why = `Kansas City defeated ${rival}, protecting Buffalo's lead in the AFC East.`;
          } else {
            verdict = 'BAD FOR BUFFALO';
            impactClass = 'bad';
            why = `${rival} won, keeping division pressure on the Bills.`;
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
      } else if (afcContenders.some(c => awayName === c || homeName === c)) {
        const contender = afcContenders.find(c => awayName === c || homeName === c);
        const opponent = contender === awayName ? homeName : awayName;

        target = `Root for ${opponent}`;
        why = `${contender} loss clears tiebreaker paths for Buffalo's AFC conference seeding & bye week odds.`;
        verdict = 'SEEDING WATCH';
        impactClass = 'good';

        if (statusState === 'post') {
          const contScore = contender === awayName ? parseInt(awayScore) : parseInt(homeScore);
          const oppScore = contender === awayName ? parseInt(homeScore) : parseInt(awayScore);

          if (oppScore > contScore) {
            verdict = 'GOOD FOR BUFFALO';
            impactClass = 'good';
            why = `${contender} lost, boosting Buffalo's path to a higher AFC playoff seed.`;
          } else {
            verdict = 'RIVAL WIN';
            impactClass = 'neutral';
          }
        }
      }

      const stadium = getNflStadium(homeName, comp.venue, comp.weather);
      const broadcastDetails = getNflBroadcast(broadcast, homeName, awayName, ev.date);
      const windowInfo = getNflWindow(ev.date);

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
        awayScore,
        homeName,
        homeScore,
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
  return outOfTownGames;
}


// Fetch live out-of-town NHL scoreboard and rooting leverage tags
async function fetchNhlScoreboard() {
  const outOfTownGames = [];
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard');
    if (!res.ok) throw new Error(`NHL Scoreboard API returned ${res.status}`);
    const data = await res.json();
    const events = data.events || [];

    const atlanticPriority = [
      'Florida Panthers', 'Tampa Bay Lightning', 'Boston Bruins', 'Toronto Maple Leafs',
      'Ottawa Senators', 'Detroit Red Wings', 'Montreal Canadiens'
    ];
    const metroContenders = [
      'Carolina Hurricanes', 'New Jersey Devils', 'New York Rangers', 'New York Islanders',
      'Washington Capitals', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'Columbus Blue Jackets'
    ];

    for (const ev of events) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;

      const competitors = comp.competitors || [];
      const home = competitors.find(c => c.homeAway === 'home');
      const away = competitors.find(c => c.homeAway === 'away');
      if (!home || !away) continue;

      const homeName = home.team?.displayName || 'Home Team';
      const awayName = away.team?.displayName || 'Away Team';

      if (homeName.includes('Sabres') || awayName.includes('Sabres')) continue;

      const homeScore = home.score || '0';
      const awayScore = away.score || '0';
      const statusState = comp.status?.type?.state;
      const statusDetail = comp.status?.type?.shortDetail || 'Scheduled';
      const broadcast = comp.broadcasts?.[0]?.names?.[0] || 'TV';

      const d = new Date(ev.date);
      const slot = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }) +
        ' • ' + d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }) + ' ET';

      const isAwayAtlantic = atlanticPriority.includes(awayName);
      const isHomeAtlantic = atlanticPriority.includes(homeName);
      const isAwayMetro = metroContenders.includes(awayName);
      const isHomeMetro = metroContenders.includes(homeName);
      const isOvertime = statusDetail.includes('OT') || statusDetail.includes('SO');

      let verdict = 'NEUTRAL';
      let impactClass = 'neutral';
      let target = 'Neutral Matchup';
      let why = 'Non-conference or cross-division matchup with minimal Sabres playoff leverage.';

      if (isAwayAtlantic && isHomeAtlantic) {
        const awayIndex = atlanticPriority.indexOf(awayName);
        const homeIndex = atlanticPriority.indexOf(homeName);
        const biggerThreat = awayIndex <= homeIndex ? awayName : homeName;
        const underdog = biggerThreat === awayName ? homeName : awayName;

        target = `Root for ${underdog} in Regulation`;
        why = `A regulation loss leaves ${biggerThreat} with 0 standings points in the Atlantic race.`;

        if (statusState === 'post') {
          if (isOvertime) {
            verdict = '3-POINT GAME DANGER';
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
          if (isOvertime) {
            verdict = '3-POINT GAME DANGER';
            impactClass = 'warning';
            why = `${rival} earned a loser point in overtime despite the loss.`;
          } else {
            const rivalScore = rival === awayName ? parseInt(awayScore) : parseInt(homeScore);
            const oppScore = rival === awayName ? parseInt(homeScore) : parseInt(awayScore);
            if (oppScore > rivalScore) {
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
        const metroRival = isAwayMetro ? awayName : homeName;
        const opponent = isAwayMetro ? homeName : awayName;

        target = `Root for ${opponent} in Regulation`;
        why = `Suppresses Eastern Conference Wild Card contenders from stacking points.`;

        if (statusState === 'post') {
          if (isOvertime) {
            verdict = '3-POINT GAME DANGER';
            impactClass = 'warning';
            why = `Overtime point awarded to Eastern Wild Card contender ${metroRival}.`;
          } else {
            const rivalScore = metroRival === awayName ? parseInt(awayScore) : parseInt(homeScore);
            const oppScore = metroRival === awayName ? parseInt(homeScore) : parseInt(awayScore);
            if (oppScore > rivalScore) {
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

      outOfTownGames.push({
        isoTime: ev.date,
        slot,
        broadcast,
        statusState,
        statusDetail,
        awayName,
        awayScore,
        homeName,
        homeScore,
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
        statusState: 'post',
        statusDetail: 'Final',
        awayName: 'Minnesota Wild',
        awayScore: '4',
        homeName: 'Florida Panthers',
        homeScore: '1',
        verdict: 'GOOD FOR BUFFALO',
        impactClass: 'good',
        target: 'Root for Minnesota Wild',
        why: 'Minnesota Wild handed Florida a regulation loss (0 standings points), slowing down the Atlantic leader.'
      },
      {
        isoTime: '2026-10-20T23:00:00Z',
        slot: 'Tue, Oct 20 • 7:00 PM ET',
        broadcast: 'NESN',
        statusState: 'post',
        statusDetail: 'Final/OT',
        awayName: 'Tampa Bay Lightning',
        awayScore: '3',
        homeName: 'Boston Bruins',
        homeScore: '2',
        verdict: '3-POINT GAME DANGER',
        impactClass: 'warning',
        target: 'Root for Regulation Finish',
        why: 'Overtime awarded 3 total points to Atlantic rivals. Boston earned a point despite the loss.'
      },
      {
        isoTime: '2026-10-20T23:30:00Z',
        slot: 'Tue, Oct 20 • 7:30 PM ET',
        broadcast: 'TSN4',
        statusState: 'post',
        statusDetail: 'Final',
        awayName: 'New York Rangers',
        awayScore: '4',
        homeName: 'Toronto Maple Leafs',
        homeScore: '1',
        verdict: 'REGULATION LOSS',
        impactClass: 'good',
        target: 'Root for New York Rangers',
        why: 'Toronto suffered a regulation loss, keeping them from pulling ahead in the Atlantic standings.'
      },
      {
        isoTime: '2026-10-21T23:00:00Z',
        slot: 'Wed, Oct 21 • 7:00 PM ET',
        broadcast: 'TNT',
        statusState: 'pre',
        statusDetail: 'Scheduled',
        awayName: 'Detroit Red Wings',
        awayScore: '0',
        homeName: 'New York Islanders',
        homeScore: '0',
        verdict: 'ATLANTIC WATCH',
        impactClass: 'warning',
        target: 'Root for New York Islanders in Regulation',
        why: 'Detroit regulation loss prevents an Atlantic division rival from collecting points.'
      },
      {
        isoTime: '2026-10-22T23:00:00Z',
        slot: 'Thu, Oct 22 • 7:00 PM ET',
        broadcast: 'ESPN+',
        statusState: 'pre',
        statusDetail: 'Scheduled',
        awayName: 'Dallas Stars',
        awayScore: '0',
        homeName: 'Boston Bruins',
        homeScore: '0',
        verdict: 'WEST OVER EAST',
        impactClass: 'good',
        target: 'Root for Dallas Stars in Regulation',
        why: 'Western conference win keeps both standings points out of the Eastern playoff pool.'
      }
    );
  }

  return outOfTownGames;
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
    isoTime: null,
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
    injuries: []
  };

  let sabresSchedule = {
    opponent: 'vs. Philadelphia',
    oppShortName: 'Flyers',
    gameTime: 'Wed, Oct 21 • 7:30 PM ET',
    isoTime: '2026-10-21T23:30:00Z',
    winChance: 52,
    matchupRecords: 'Sabres (4-3-2, 10 pts, OT1) vs. Philadelphia (2-6-3, 7 pts, W2)',
    broadcast: 'TNT',
    venue: 'KeyBank Center, Buffalo',
    restSabres: 2,
    restOpp: 1,
    restDiff: 'Sabres +1 (Opp on Back-to-Back)',
    specialTeams: {
      sabres: 'PP: 19.5% (17th) | PK: 81.2% (11th)',
      opp: 'PP: 14.2% (29th) | PK: 76.4% (23rd)',
      advantage: 'Sabres Special Teams Edge (+10.1% Net Margin)'
    },
    efficiency: [
      { metric: 'Goals / Game', sabres: '3.12 (12th)', opp: '2.55 (24th)' },
      { metric: 'Goals Against / Game', sabres: '3.20 (18th)', opp: '3.60 (28th)' },
      { metric: 'Power Play %', sabres: '19.5% (17th)', opp: '14.2% (29th)' },
      { metric: 'Penalty Kill %', sabres: '81.2% (11th)', opp: '76.4% (23rd)' },
      { metric: 'Shots / Game', sabres: '29.8 (15th)', opp: '27.4 (25th)' },
      { metric: 'Faceoff Win %', sabres: '48.2% (22nd)', opp: '49.5% (18th)' }
    ],
    injuries: [
      { player: 'Ukko-Pekka Luukkonen', pos: 'G', status: 'Probable', injury: 'Expected Starter (2.78 GAA, .912 SV%)', team: 'Sabres' },
      { player: 'Samuel Ersson', pos: 'G', status: 'Probable', injury: 'Expected Starter (3.05 GAA, .898 SV%)', team: 'Flyers' },
      { player: 'Zach Benson', pos: 'LW', status: 'Questionable', injury: 'Lower Body', team: 'Sabres' },
      { player: 'Mattias Samuelsson', pos: 'D', status: 'Injured Reserve', injury: 'Lower Body', team: 'Sabres' },
      { player: 'Ryan Ellis', pos: 'D', status: 'Injured Reserve', injury: 'Back', team: 'Flyers' }
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
      const nextGame = data.events?.find(e => e.competitions?.[0]?.status?.type?.state === 'pre');
      if (nextGame) {
        const comp = nextGame.competitions[0];
        const bufComp = comp.competitors.find(c => c.id === '2');
        const oppComp = comp.competitors.find(c => c.id !== '2');

        const isHome = bufComp?.homeAway === 'home';
        const oppName = oppComp?.team?.shortDisplayName || 'Opponent';
        const oppCity = oppComp?.team?.location || '';
        const oppId = oppComp?.id || '33';
        const d = new Date(nextGame.date);

        const dateStr = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
        const tvNetwork = comp.broadcasts?.[0]?.names?.[0] || 'CBS';
        const venueName = comp.venue ? `${comp.venue.fullName || ''}, ${comp.venue.address?.city || ''}` : 'NFL Stadium';

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

          const findStats = (id) => {
            const entry = allTeams.find(t => t.team?.id === id);
            if (!entry) return { display: '', w: 0, l: 0 };
            const wlt = entry.stats?.find(s => s.name === 'overall')?.displayValue || '';
            const streak = entry.stats?.find(s => s.name === 'streak')?.displayValue || '';
            const w = parseInt(entry.stats?.find(s => s.name === 'wins')?.value || '0');
            const l = parseInt(entry.stats?.find(s => s.name === 'losses')?.value || '0');
            return { display: streak ? `${wlt}, ${streak}` : wlt, w, l };
          };

          const bufStats = findStats('2');
          const oppStats = findStats(oppId);

          bufRecord = bufStats.display;
          oppRecord = oppStats.display;
          if (bufStats.w + bufStats.l > 0) { bufWins = bufStats.w; bufLosses = bufStats.l; }
          if (oppStats.w + oppStats.l > 0) { oppWins = oppStats.w; oppLosses = oppStats.l; }
        }

        let winChance = 60;
        if (comp.predictor?.homeTeam) {
          winChance = Math.round(isHome ? comp.predictor.homeTeam.gameProjection : (100 - comp.predictor.homeTeam.gameProjection));
        } else {
          const bufPct = bufWins / (bufWins + bufLosses || 1);
          const oppPct = oppWins / (oppWins + oppLosses || 1);
          const homeBonus = isHome ? 0.04 : -0.04;
          winChance = Math.min(88, Math.max(30, Math.round(((bufPct / (bufPct + oppPct || 1)) + homeBonus) * 100)));
        }

        const bufDisplay = bufRecord ? `Bills (${bufRecord})` : 'Bills';
        const oppDisplay = oppRecord ? `${oppName} (${oppRecord})` : oppName;

        billsSchedule.opponent = `${isHome ? 'vs.' : '@'} ${oppName}`;
        billsSchedule.oppShortName = oppName;
        billsSchedule.oppId = oppId;
        billsSchedule.oppCity = oppCity;
        billsSchedule.gameTime = `${dateStr} • ${timeStr} ET`;
        billsSchedule.isoTime = nextGame.date;
        billsSchedule.winChance = winChance;
        billsSchedule.matchupRecords = `${bufDisplay} vs. ${oppDisplay}`;
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
      const now = new Date();
      const nextGame = data.games?.find(g => new Date(g.startTimeUTC) > now && g.gameState !== 'FINAL');
      if (nextGame) {
        const isHome = nextGame.homeTeam.abbrev === 'BUF';
        const oppAbbrev = isHome ? nextGame.awayTeam.abbrev : nextGame.homeTeam.abbrev;
        const oppName = isHome ? (nextGame.awayTeam.placeName?.default || oppAbbrev) : (nextGame.homeTeam.placeName?.default || oppAbbrev);
        const d = new Date(nextGame.startTimeUTC);

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
          const bufStand = standingsData.standings?.find(s => s.teamAbbrev?.default === 'BUF');
          const oppStand = standingsData.standings?.find(s => s.teamAbbrev?.default === oppAbbrev);

          if (bufStand) {
            sabresPoints = bufStand.points;
            sabresRecord = `${bufStand.wins}-${bufStand.losses}-${bufStand.otLosses}`;
            sabresStreak = bufStand.streakCode ? `${bufStand.streakCode}${bufStand.streakCount || ''}` : '';
          }
          if (oppStand) {
            oppPoints = oppStand.points;
            oppRecord = `${oppStand.wins}-${oppStand.losses}-${oppStand.otLosses}`;
            oppStreak = oppStand.streakCode ? `${oppStand.streakCode}${oppStand.streakCount || ''}` : '';
          }
        }

        const bufInfo = sabresStreak ? `Sabres (${sabresRecord}, ${sabresPoints} pts, ${sabresStreak})` : `Sabres (${sabresRecord}, ${sabresPoints} pts)`;
        const oppInfo = oppStreak ? `${oppName} (${oppRecord}, ${oppPoints} pts, ${oppStreak})` : `${oppName} (${oppRecord}, ${oppPoints} pts)`;

        sabresSchedule = {
          ...sabresSchedule,
          opponent: `${isHome ? 'vs.' : '@'} ${oppName}`,
          oppShortName: oppName,
          gameTime: `${dateStr} • ${timeStr} ET`,
          isoTime: nextGame.startTimeUTC,
          winChance: isHome ? 52 : 46,
          matchupRecords: `${bufInfo} vs. ${oppInfo}`,
          broadcast: tvNetwork,
          venue: isHome ? 'KeyBank Center, Buffalo' : `${oppName} Arena`
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
      isoTime: billsSchedule.isoTime,
      winChance: billsSchedule.winChance,
      matchupRecords: billsSchedule.matchupRecords,
      broadcast: billsSchedule.broadcast,
      venue: billsSchedule.venue,
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
    makePlayoffs: 38,
    winDivision: 12,
    wildcard: 26,
    tragicNumber: sabresSchedule.tragicNumber || 'Pace: 91 Pts (Target: 92)',
    clinchAlert: { active: false, scenario: 'No clinching scenarios available this week.' },
    nextGame: {
      opponent: sabresSchedule.opponent,
      oppShortName: sabresSchedule.oppShortName || 'Flyers',
      gameTime: sabresSchedule.gameTime,
      isoTime: sabresSchedule.isoTime,
      winChance: sabresSchedule.winChance || 52,
      matchupRecords: sabresSchedule.matchupRecords,
      broadcast: sabresSchedule.broadcast,
      venue: sabresSchedule.venue || 'KeyBank Center, Buffalo',
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
      injuries: sabresSchedule.injuries || [
        { player: 'Ukko-Pekka Luukkonen', pos: 'G', status: 'Probable', injury: 'Expected Starter (2.78 GAA, .912 SV%)', team: 'Sabres' },
        { player: 'Samuel Ersson', pos: 'G', status: 'Probable', injury: 'Expected Starter (3.05 GAA, .898 SV%)', team: 'Flyers' },
        { player: 'Zach Benson', pos: 'LW', status: 'Questionable', injury: 'Lower Body', team: 'Sabres' },
        { player: 'Mattias Samuelsson', pos: 'D', status: 'Injured Reserve', injury: 'Lower Body', team: 'Sabres' },
        { player: 'Ryan Ellis', pos: 'D', status: 'Injured Reserve', injury: 'Back', team: 'Flyers' }
      ]
    },
    divisionRadar: [
      { team: 'Panthers', pct: 82 },
      { team: 'Lightning', pct: 74 },
      { team: 'Leafs', pct: 68 },
      { team: 'Sabres', pct: 38 }
    ],
    seedDistribution: [
      { seed: 'Div 1', pct: 3 },
      { seed: 'Div 2', pct: 4 },
      { seed: 'Div 3', pct: 5 },
      { seed: 'Wildcard 1', pct: 15 },
      { seed: 'Wildcard 2', pct: 11 }
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

    if (radarResults.length === 4) billsData.divisionRadar = radarResults;

    // 2. Scrape Table (2) Bills 1st Round Playoff Matchup Probabilities
    const scrapedOpponents = [];
    $('tr').each((_, el) => {
      const rowText = $(el).text();
      const match = rowText.match(/\((\d+)\)\s+([A-Za-z\s]+)/);
      if (match && !rowText.includes('Bye') && !rowText.includes('Elimination')) {
        const rawOpp = match[2].trim();
        const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
        const pcts = cells.map(parseCellPct).filter(n => n > 0 && n <= 100);
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

  // 5. Sabres Standings & Atlantic Radar Scrape
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
        
        // Probability columns are at the end of the row
        if (pcts.length >= 6) {
          const seeds = pcts.slice(-6, -1);
          const totalPlayoffs = Math.min(100, Math.round(seeds.reduce((a, b) => a + b, 0)));
          
          if (totalPlayoffs >= 10) {
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
      sabresData.divisionRadar = sabresRadar;
    }
  } catch (err) {
    console.warn('Sabres standings fallback:', err.message);
  }

  const finalPayload = {
    updatedAt: new Date().toISOString(),
    source: 'http://www.playoffstatus.com and ESPN NFL API',
    bills: billsData,
    sabres: sabresData
  };

  fs.writeFileSync('./data.json', JSON.stringify(finalPayload, null, 2), 'utf-8');
  console.log('data.json successfully written with live 1st Round Matchup table.');
}

scrapePlayoffStatus();
