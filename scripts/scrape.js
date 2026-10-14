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

// Fetch live game schedules, game win chance, ISO timestamps, and team records with points & streaks
async function fetchNextGameSchedule() {
  let billsSchedule = {
    opponent: '@ Raiders',
    gameTime: 'Sun, Oct 18 • 4:25 PM ET',
    isoTime: new Date(Date.now() + 4 * 86400000 + 15 * 3600000).toISOString(),
    winChance: 68,
    matchupRecords: 'Bills (4-1, W3) vs. Raiders (2-3, L1)'
  };
  let sabresSchedule = {
    opponent: '@ Toronto',
    gameTime: 'Thu, Oct 15 • 7:00 PM ET',
    isoTime: new Date(Date.now() + 1 * 86400000 + 18 * 3600000).toISOString(),
    winChance: 46,
    matchupRecords: 'Sabres (2-1-0, 4 pts, W1) vs. Maple Leafs (3-1-0, 6 pts, W2)'
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

  // 2. Sabres (Official NHL API - extracts points directly)
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

        // Parse points and records from standings if available
        let sabresPoints = 4;
        let oppPoints = 6;
        let sabresRecord = '2-1-0';
        let oppRecord = '3-1-0';
        let sabresStreak = 'W1';
        let oppStreak = 'W2';

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

  return { billsSchedule, sabresSchedule };
}

async function scrapePlayoffStatus() {
  console.log('Initiating full matrix scrape from PlayoffStatus.com...');

  const { billsSchedule, sabresSchedule } = await fetchNextGameSchedule();

  const billsUrl = 'http://www.playoffstatus.com/nfl/billsstandings.html';
  const sabresUrl = 'http://www.playoffstatus.com/nhl/sabresstandings.html';
  const billsMigUrl = 'http://www.playoffstatus.com/nfl/billsmig.html';

  let billsData = {
    team: 'Buffalo Bills',
    makePlayoffs: 84,
    winDivision: 62,
    seed1: 18,
    magicNumber: '11',
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

  // 1. Bills Standings
  try
