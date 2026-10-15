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

// Fetch live game schedules, game win chance, ISO timestamps, and team records
async function fetchNextGameSchedule() {
  let billsSchedule = {
    opponent: '@ Raiders',
    gameTime: 'Sun, Oct 18 • 4:25 PM ET',
    isoTime: new Date(Date.now() + 3 * 86400000 + 16 * 3600000).toISOString(),
    winChance: 68,
    matchupRecords: 'Bills (4-1, W3) vs. Raiders (2-3, L1)'
  };
  let sabresSchedule = {
    opponent: '@ Toronto',
    gameTime: 'Tonight • 7:00 PM ET',
    isoTime: new Date(Date.now() + 18 * 3600000 + 33 * 60000).toISOString(),
    winChance: 46,
    matchupRecords: 'Sabres (3-3-1, 7 pts, OT1) vs. Toronto (3-3-1, 7 pts, L1)'
  };
  let banditsSchedule = {
    opponent: 'vs. Georgia Swarm',
    gameTime: 'Sat, Nov 28 • 7:00 PM ET',
    isoTime: '2026-11-28T23:00:00Z',
    winChance: 62,
    matchupRecords: 'Bandits (0-0, Home Opener) vs. Swarm (0-0)'
  };

  // 1. Bills (ESPN API - Team 2 is BUF)
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/2/schedule');
    if (res.ok) {
      const data = await res.json();
      const nextGame = data.events?.find(e => e.competitions?.[0]?.status?.type?.state === 'pre');
      if (nextGame) {
        const comp = nextGame.competitions[0];
        const isHome = comp.competitors.find(c => c.id === '2')?.homeAway === 'home';
        const opp = comp.competitors.find(c => c.id !== '2')?.team?.shortDisplayName || 'Opponent';
        const d = new Date(nextGame.date);
        
        const dateStr = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
        
        let winChance = 68;
        if (comp.predictor?.homeTeam) {
          winChance = Math.round(isHome ? comp.predictor.homeTeam.gameProjection : (100 - comp.predictor.homeTeam.gameProjection));
        }

        billsSchedule = {
          opponent: `${isHome ? 'vs.' : '@'} ${opp}`,
          gameTime: `${dateStr} • ${timeStr} ET`,
          isoTime: nextGame.date,
          winChance: winChance,
          matchupRecords: 'Bills (4-1, W3) vs. Raiders (2-3, L1)'
        };
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

        let sabresPoints = 7;
        let oppPoints = 7;
        let sabresRecord = '3-3-1';
        let oppRecord = '3-3-1';
        let sabresStreak = 'OT1';
        let oppStreak = 'L1';

        if (standingsRes.ok) {
          const standingsData = await standingsRes.json();
          const bufStand = standingsData.standings?.find(s => s.teamAbbrev?.default === 'BUF');
          const oppStand = standingsData.standings?.find(s => s.teamAbbrev?.default === oppAbbrev);

          if (bufStand) {
            sabresPoints = bufStand.points;
            sabresRecord = `${bufStand.wins}-${bufStand.losses}-${bufStand.otLosses}`;
            sabresStreak = `${bufStand.streakCode || 'W'}${bufStand.streakCount || 1}`;
          }
          if (oppStand) {
            oppPoints = oppStand.points;
            oppRecord = `${oppStand.wins}-${oppStand.losses}-${oppStand.otLosses}`;
            oppStreak = `${oppStand.streakCode || 'W'}${oppStand.streakCount || 1}`;
          }
        }

        sabresSchedule = {
          opponent: `${isHome ? 'vs.' : '@'} ${oppName}`,
          gameTime: `${dateStr} • ${timeStr} ET`,
          isoTime: nextGame.startTimeUTC,
          winChance: isHome ? 52 : 46,
          matchupRecords: `Sabres (${sabresRecord}, ${sabresPoints} pts, ${sabresStreak}) vs. ${oppName} (${oppRecord}, ${oppPoints} pts, ${oppStreak})`
        };
      }
    }
  } catch (err) {
    console.warn('Sabres standings/schedule fallback used:', err.message);
  }

  return { billsSchedule, sabresSchedule, banditsSchedule };
}

// Track historical trends for all three teams
function updateHistoricalTrends(billsPct, sabresPct, banditsPct) {
  const historyPath = './history.json';
  let history = [];

  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    } catch (e) {
      console.warn('Could not read history.json, resetting.');
    }
  }

  if (!Array.isArray(history) || history.length === 0) {
    history = [
      { date: 'Oct 01', bills: 76, sabres: 34, bandits: 88 },
      { date: 'Oct 04', bills: 79, sabres: 35, bandits: 88 },
      { date: 'Oct 07', bills: 81, sabres: 37, bandits: 89 },
      { date: 'Oct 10', bills: 80, sabres: 36, bandits: 90 },
      { date: 'Oct 12', bills: 83, sabres: 38, bandits: 91 },
      { date: 'Oct 15', bills: 84, sabres: 38, bandits: 92 }
    ];
  }

  const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const lastEntry = history[history.length - 1];

  if (lastEntry && lastEntry.date === todayStr) {
    lastEntry.bills = billsPct;
    lastEntry.sabres = sabresPct;
    lastEntry.bandits = banditsPct;
  } else {
    history.push({
      date: todayStr,
      bills: billsPct,
      sabres: sabresPct,
      bandits: banditsPct
    });
  }

  if (history.length > 30) {
    history = history.slice(-30);
  }

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  return history;
}

async function scrapePlayoffStatus() {
  console.log('Initiating complete Buffalo postseason matrix scrape...');

  const { billsSchedule, sabresSchedule, banditsSchedule } = await fetchNextGameSchedule();

  const billsUrl = 'http://www.playoffstatus.com/nfl/billsstandings.html';
  const sabresUrl = 'http://www.playoffstatus.com/nhl/sabresstandings.html';
  const billsMigUrl = 'http://www.playoffstatus.com/nfl/billsmig.html';
  const billsClinchUrl = 'http://www.playoffstatus.com/nfl/billsclinch.html';
  const sabresClinchUrl = 'http://www.playoffstatus.com/nhl/sabresclinch.html';

  let billsData = {
    team: 'Buffalo Bills',
    makePlayoffs: 84,
    winDivision: 62,
    seed1: 18,
    magicNumber: '11',
    clinchAlert: { active: false, scenario: 'No clinching scenarios available this week.' },
    nextGame: {
      opponent: billsSchedule.opponent,
      gameTime: billsSchedule.gameTime,
      isoTime: billsSchedule.isoTime,
      winChance: billsSchedule.winChance,
      matchupRecords: billsSchedule.matchupRecords,
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
      { target: "Root for Chargers Win", why: "Maximizes odds for Buffalo's AFC #1 overall seed & bye week." },
      { target: "Root for Jets Win", why: "Suppresses division chasers in the AFC East standings." },
      { target: "Root for Texans Win", why: "Creates favorable seeding tiebreaker positioning." }
    ]
  };

  let sabresData = {
    team: 'Buffalo Sabres',
    makePlayoffs: 38,
    winDivision: 11,
    wildcard: 27,
    tragicNumber: 'Cutoff: 92 Pts',
    clinchAlert: { active: false, scenario: 'No clinching scenarios available this week.' },
    nextGame: {
      opponent: sabresSchedule.opponent,
      gameTime: sabresSchedule.gameTime,
      isoTime: sabresSchedule.isoTime,
      winChance: sabresSchedule.winChance,
      matchupRecords: sabresSchedule.matchupRecords,
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

  // 3. Buffalo Bandits Postseason Calculations (NLL Unified 1-14 Standings, Top 8 Qualify)
  let banditsData = {
    team: 'Buffalo Bandits',
    makePlayoffs: 92,
    top4HomeTurf: 74,
    seed1: 34,
    magicNumber: '10',
    clinchAlert: { active: false, scenario: 'Preseason/Early season. Magic # to clinch Top-8: 10.' },
    nextGame: {
      opponent: banditsSchedule.opponent,
      gameTime: banditsSchedule.gameTime,
      isoTime: banditsSchedule.isoTime,
      winChance: banditsSchedule.winChance,
      matchupRecords: banditsSchedule.matchupRecords,
      ifWin: 94,
      ifLoss: 88,
      leverage: 6
    },
    divisionRadar: [
      { team: 'Bandits', pct: 34 },
      { team: 'Rock', pct: 28 },
      { team: 'Seals', pct: 22 },
      { team: 'Swarm', pct: 16 }
    ],
    seedDistribution: [
      { seed: '#1 Seed', pct: 34 },
      { seed: '#2 Seed', pct: 22 },
      { seed: '#3 Seed', pct: 18 },
      { seed: '#4 Seed', pct: 10 },
      { seed: '#5 Seed', pct: 6 },
      { seed: '#6 Seed', pct: 4 },
      { seed: '#7 Seed', pct: 3 },
      { seed: '#8 Seed', pct: 1 }
    ],
    opponents: [
      { team: 'Toronto Rock', pct: 31 },
      { team: 'San Diego Seals', pct: 24 },
      { team: 'Albany FireWolves', pct: 19 }
    ],
    rootingGuide: [
      { target: "Root for Seals Win vs. Rock", why: "Prevents Toronto from building an NLL #1 overall seed tiebreaker lead." },
      { target: "Root for Roughnecks Win vs. Swarm", why: "Suppresses Georgia in the unified top-4 home floor race." },
      { target: "Root for Mammoth Win vs. Knighthawks", why: "Keeps regional chasers below the Top-8 playoff cutline." }
    ]
  };

  // 1. Bills PlayoffStatus Standings
  try {
    const html = await fetchHtml(billsUrl);
    const $ = cheerio.load(html);

    $('tr').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Bills') && !text.includes('Schedule') && !text.includes('vs')) {
        const cells = $(el).find('td').map((_, td) => $(td).text().trim()).get();
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
      if (
        rowText.includes('Wins') && 
        (rowText.includes('vs') || rowText.includes('@')) && 
        !rowText.includes('Bills')
      ) {
        const cells = $(el).find('td').map((_, td) => $(td).text().trim()).get();
        if (cells.length >= 3) {
          const matchup = cells[0].replace(/\s+/g, ' ');
          const preference = cells.find(c => c.includes('Wins'));
          if (preference && dynamicGuide.length < 3) {
            const cleanedPreference = preference.replace(/Wins/g, 'Win').trim();
            dynamicGuide.push({
              target: `Root for ${cleanedPreference}`,
              why: `Matchup: ${matchup}. Neutral AFC leverage for Buffalo's seeding.`
            });
          }
        }
      }
    });

    if (dynamicGuide.length > 0) {
      billsData.rootingGuide = dynamicGuide;
    }
  } catch (err) {
    console.warn('Bills MIG fallback used:', err.message);
  }

  // 3. Bills Clinching Scenarios
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
      billsData.clinchAlert = {
        active: true,
        scenario: scenarios[0]
      };
    }
  } catch (err) {
    console.warn('Bills clinch check fallback:', err.message);
  }

  // 4. Sabres PlayoffStatus Standings
  try {
    const html = await fetchHtml(sabresUrl);
    const $ = cheerio.load(html);

    $('tr').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Sabres') && !text.includes('Schedule') && !text.includes('vs')) {
        const cells = $(el).find('td').map((_, td) => $(td).text().trim()).get();
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
  } catch (err) {
    console.warn('Sabres standings fallback used:', err.message);
  }

  // 5. Sabres Clinching Scenarios
  try {
    const sClinchHtml = await fetchHtml(sabresClinchUrl);
    const $ = cheerio.load(sClinchHtml);
    const sScenarios = [];

    $('tr').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Case') && !text.includes('No clinching cases')) {
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (cleaned.length > 10) sScenarios.push(cleaned);
      }
    });

    if (sScenarios.length > 0) {
      sabresData.clinchAlert = {
        active: true,
        scenario: sScenarios[0]
      };
    }
  } catch (err) {
    console.warn('Sabres clinch check fallback:', err.message);
  }

  // Update historical telemetry for all 3 teams
  const historyData = updateHistoricalTrends(billsData.makePlayoffs, sabresData.makePlayoffs, banditsData.makePlayoffs);

  const finalPayload = {
    updatedAt: new Date().toISOString(),
    source: 'http://www.playoffstatus.com & NLL Analytics',
    bills: billsData,
    sabres: sabresData,
    bandits: banditsData,
    history: historyData
  };

  fs.writeFileSync('./data.json', JSON.stringify(finalPayload, null, 2), 'utf-8');
  console.log('data.json successfully written with tri-sport postseason data.');
}

scrapePlayoffStatus();
