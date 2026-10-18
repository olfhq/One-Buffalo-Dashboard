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

// Fetch live out-of-town scoreboard and rooting leverage tags
async function fetchNflScoreboard() {
  const outOfTownGames = [];
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    if (!res.ok) return outOfTownGames;
    const data = await res.json();
    const events = data.events || [];

    const afcEastTeams = ['New England Patriots', 'Miami Dolphins', 'New York Jets'];
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

      // Skip the Bills game (featured on Matchup Intel tab)
      if (homeName.includes('Bills') || awayName.includes('Bills')) continue;

      const homeScore = home.score || '0';
      const awayScore = away.score || '0';
      const statusState = comp.status?.type?.state; // 'pre', 'in', 'post'
      const statusDetail = comp.status?.type?.shortDetail || 'Scheduled';
      const broadcast = comp.broadcasts?.[0]?.names?.[0] || 'TV';

      const d = new Date(ev.date);
      const slot = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }) +
        ' • ' + d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }) + ' ET';

      // Determine Buffalo Rooting Verdict
      let verdict = 'NEUTRAL';
      let impactClass = 'neutral';
      let target = 'Neutral Matchup';
      let why = 'Non-conference game with zero immediate AFC tiebreaker leverage.';

      const rival = [awayName, homeName].find(n => afcEastTeams.includes(n));
      const contender = [awayName, homeName].find(n => afcContenders.includes(n));

      if (rival) {
        const opponent = rival === awayName ? homeName : awayName;
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
            why = `${rival} dropped a division game, widening Buffalo's lead.`;
          }
        } else if (statusState === 'in') {
          verdict = 'AFC EAST WATCH';
          impactClass = 'bad';
        } else {
          verdict = 'AFC EAST WATCH';
          impactClass = 'bad';
        }
      } else if (contender) {
        const opponent = contender === awayName ? homeName : awayName;
        target = `Root for ${opponent}`;
        why = `${contender} loss clears seeding tiebreakers for the AFC #1 overall seed.`;
        verdict = 'SEEDING WATCH';
        impactClass = 'good';

        if (statusState === 'post') {
          const contScore = contender === awayName ? parseInt(awayScore) : parseInt(homeScore);
          const oppScore = contender === awayName ? parseInt(homeScore) : parseInt(awayScore);
          if (contScore < oppScore) {
            verdict = 'GOOD FOR BUFFALO';
            impactClass = 'good';
            why = `${contender} loss opened up Buffalo's path to a higher AFC playoff seed.`;
          } else {
            verdict = 'NEUTRAL / RIVAL WIN';
            impactClass = 'neutral';
          }
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

    // Sort games strictly chronologically by kickoff date/time
    outOfTownGames.sort((a, b) => new Date(a.isoTime) - new Date(b.isoTime));
  } catch (err) {
    console.warn('NFL Scoreboard scrape fallback:', err.message);
  }
  return outOfTownGames;
}

// Fetch live game schedules, game win chance, ISO timestamps, team records, and broadcast networks
async function fetchNextGameSchedule() {
  let billsSchedule = {
    opponent: '@ Raiders',
    gameTime: 'Sun, Oct 18 • 4:25 PM ET',
    isoTime: null,
    winChance: 68,
    matchupRecords: 'Bills vs. Raiders',
    broadcast: 'CBS'
  };
  let sabresSchedule = {
    opponent: 'vs. Philadelphia',
    gameTime: 'Wed, Oct 21 • 7:30 PM ET',
    isoTime: null,
    winChance: 52,
    matchupRecords: 'Sabres vs. Philadelphia',
    broadcast: 'MSG-B'
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
        const oppId = oppComp?.id;
        const d = new Date(nextGame.date);

        const dateStr = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
        const tvNetwork = comp.broadcasts?.[0]?.names?.[0] || 'CBS';

        let winChance = 68;
        if (comp.predictor?.homeTeam) {
          winChance = Math.round(isHome ? comp.predictor.homeTeam.gameProjection : (100 - comp.predictor.homeTeam.gameProjection));
        }

        let bufRecord = '';
        let oppRecord = '';

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
            if (!entry) return '';
            const wlt = entry.stats?.find(s => s.name === 'overall')?.displayValue || '';
            const streak = entry.stats?.find(s => s.name === 'streak')?.displayValue || '';
            return streak ? `${wlt}, ${streak}` : wlt;
          };

          bufRecord = findStats('2');
          oppRecord = findStats(oppId);
        }

        const bufDisplay = bufRecord ? `Bills (${bufRecord})` : 'Bills';
        const oppDisplay = oppRecord ? `${oppName} (${oppRecord})` : oppName;

        billsSchedule = {
          opponent: `${isHome ? 'vs.' : '@'} ${oppName}`,
          gameTime: `${dateStr} • ${timeStr} ET`,
          isoTime: nextGame.date,
          winChance: winChance,
          matchupRecords: `${bufDisplay} vs. ${oppDisplay}`,
          broadcast: tvNetwork
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
          opponent: `${isHome ? 'vs.' : '@'} ${oppName}`,
          gameTime: `${dateStr} • ${timeStr} ET`,
          isoTime: nextGame.startTimeUTC,
          winChance: isHome ? 52 : 46,
          matchupRecords: `${bufInfo} vs. ${oppInfo}`,
          broadcast: tvNetwork
        };
      }
    }
  } catch (err) {
    console.warn('Sabres schedule fallback used:', err.message);
  }

  return { billsSchedule, sabresSchedule };
}

async function scrapePlayoffStatus() {
  console.log('Initiating matrix scrape from PlayoffStatus.com and ESPN Scoreboard...');

  const [{ billsSchedule, sabresSchedule }, outOfTownGames] = await Promise.all([
    fetchNextGameSchedule(),
    fetchNflScoreboard()
  ]);

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
      broadcast: billsSchedule.broadcast,
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
    ],
    outOfTownGames: outOfTownGames
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
      broadcast: sabresSchedule.broadcast,
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

  // 1. Bills Standings & AFC East Radar Scrape
  try {
    const html = await fetchHtml(billsUrl);
    const $ = cheerio.load(html);
    const afcEastTeams = ['Bills', 'Patriots', 'Dolphins', 'Jets'];
    const radarResults = [];

    $('tr').each((_, el) => {
      const text = $(el).text();
      if (!text.includes('Schedule') && !text.includes('vs')) {
        const foundTeam = afcEastTeams.find(t => text.includes(t));
        if (foundTeam) {
          const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
          const pcts = cells.map(parseCellPct).filter(n => n >= 0 && n <= 100);

          if (pcts.length >= 7) {
            const seeds = pcts.slice(-7);
            const winDiv = seeds.slice(0, 4).reduce((a, b) => a + b, 0);

            if (!radarResults.some(r => r.team === foundTeam)) {
              radarResults.push({ team: foundTeam, pct: winDiv });
            }

            if (foundTeam === 'Bills') {
              billsData.seed1 = seeds[0];
              billsData.winDivision = winDiv;
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
        }
      }
    });

    if (radarResults.length === 4) billsData.divisionRadar = radarResults;
  } catch (err) {
    console.warn('Bills standings fallback used:', err.message);
  }

  // 2. Bills Clinching Scenarios Scrape
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

  // 3. Sabres Standings & Atlantic Radar Scrape
  try {
    const html = await fetchHtml(sabresUrl);
    const $ = cheerio.load(html);
    const atlanticTeams = ['Panthers', 'Lightning', 'Bruins', 'Sabres', 'Maple Leafs', 'Senators', 'Canadiens', 'Red Wings'];
    const sabresRadar = [];

    $('tr').each((_, el) => {
      const text = $(el).text();
      if (!text.includes('Schedule') && !text.includes('vs')) {
        const foundTeam = atlanticTeams.find(t => text.includes(t));
        if (foundTeam) {
          const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
          const pcts = cells.map(parseCellPct).filter(n => n >= 0 && n <= 100);
          
          if (pcts.length >= 5) {
            const seeds = pcts.slice(0, 5);
            const totalPlayoffs = Math.min(100, seeds.reduce((a, b) => a + b, 0));
            
            if (sabresRadar.length < 4 && !sabresRadar.some(r => r.team === foundTeam)) {
              sabresRadar.push({ team: foundTeam.replace('Maple Leafs', 'Leafs'), pct: totalPlayoffs });
            }

            if (foundTeam === 'Sabres') {
              sabresData.winDivision = seeds[0];
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

    if (sabresRadar.length > 0) sabresData.divisionRadar = sabresRadar;
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
  console.log('data.json successfully written with full scoreboard and rooting data.');
}

scrapePlayoffStatus();
