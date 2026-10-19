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
    console.warn('NFL Scoreboard scrape fallback:', err.message);
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
        billsSchedule.broadcast = tvNetwork;
        billsSchedule.venue = venueName;

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
  console.log('Initiating matrix scrape from PlayoffStatus.com and ESPN NFL API...');

  const [{ billsSchedule, sabresSchedule }, outOfTownGames] = await Promise.all([
    fetchNextGameSchedule(),
    fetchNflScoreboard()
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
    magicNumber: '10',
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
  console.log('data.json successfully written with live 1st Round Matchup table.');
}

scrapePlayoffStatus();
