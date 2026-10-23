const fs = require('fs');

const sabresHtml = fs.readFileSync('sabres.html', 'utf8');
const billsHtml = fs.readFileSync('bills.html', 'utf8');
let errors = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    errors++;
  }
}

function testCards(file, html, sport) {
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/i)[1];
  const fnCalc = scriptMatch.match(new RegExp(`function calculateLive${sport}WinChance\\([\\s\\S]*?^    \\}`, 'm'))[0];
  const fnWinChance = scriptMatch.match(new RegExp(`function get${sport}GameWinChance\\([\\s\\S]*?^    \\}`, 'm'))[0];
  const fnRender = scriptMatch.match(/function renderGameCardHtml\([\s\S]*?^    \}/m)[0];

  global.getNhlBroadcastClass = () => 'tv-espn';

  eval(fnCalc);
  eval(fnWinChance);
  eval(fnRender);

  console.log(`=== Testing ${sport} out-of-town cards (${file}) ===`);

  // 1. Live game
  const liveGame = {
    slot: '7:00 PM ET',
    broadcast: 'TNT',
    announcers: 'Crew',
    venue: 'Arena',
    statusState: 'in',
    statusDetail: sport === 'Nhl' ? '18:37 - 2nd' : '3rd Qtr 4:15',
    awayName: 'Away Team',
    awayScore: '1',
    homeName: 'Home Team',
    homeScore: '2',
    verdict: 'WATCH',
    impactClass: 'warning',
    target: 'Root for Home Team',
    why: 'Good outcome for Buffalo.'
  };
  const liveHtml = renderGameCardHtml(liveGame);
  assert(liveHtml.includes('win-prob-chip'), `${sport} LIVE card missing win-prob-chip`);
  assert(liveHtml.includes('card-win-pill'), `${sport} LIVE card missing card-win-pill`);
  assert(liveHtml.includes('win-chance-meter-wrap'), `${sport} LIVE card missing win-chance-meter-wrap`);
  console.log(`${sport} LIVE card rendered properly.`);

  // 2. Final game
  const finalGame = {
    slot: '7:00 PM ET',
    broadcast: 'ESPN',
    announcers: 'Crew',
    venue: 'Arena',
    statusState: 'post',
    statusDetail: 'Final',
    awayName: 'Away Team',
    awayScore: '4',
    homeName: 'Home Team',
    homeScore: '1',
    verdict: 'GOOD',
    impactClass: 'good',
    target: 'Root for Away Team',
    why: 'Good outcome for Buffalo.'
  };
  const finalHtml = renderGameCardHtml(finalGame);
  assert(finalHtml.includes('100%'), `${sport} FINAL card missing 100%`);
  assert(finalHtml.includes('0%'), `${sport} FINAL card missing 0%`);
  console.log(`${sport} FINAL card rendered properly.`);

  // 3. Pre-game
  const preGame = {
    slot: '7:00 PM ET',
    broadcast: 'ESPN',
    announcers: 'Crew',
    venue: 'Arena',
    statusState: 'pre',
    statusDetail: 'Scheduled',
    awayName: 'Away Team',
    awayScore: '',
    homeName: 'Home Team',
    homeScore: '',
    verdict: 'UPCOMING',
    impactClass: 'neutral',
    target: 'Neutral Game',
    why: 'Analysis here.'
  };
  const preHtml = renderGameCardHtml(preGame);
  assert(preHtml.includes('win-prob-chip'), `${sport} PRE card missing win-prob-chip`);
  assert(preHtml.includes('win-chance-meter-wrap'), `${sport} PRE card missing win-chance-meter-wrap`);
  console.log(`${sport} PRE card rendered properly.`);

  // 4. Game with record and streak (e.g. Ravens 4-2, L1)
  const gameWithRecords = {
    ...liveGame,
    awayName: 'Baltimore Ravens',
    awayRecord: '4-2, L1',
    homeName: 'Cleveland Browns',
    homeRecord: '1-5, L4'
  };
  const recordHtml = renderGameCardHtml(gameWithRecords);
  assert(recordHtml.includes('score-team-record'), `${sport} card missing score-team-record element`);
  assert(recordHtml.includes('(4-2, L1)'), `${sport} card missing away record and streak like (4-2, L1)`);
  assert(recordHtml.includes('(1-5, L4)'), `${sport} card missing home record and streak like (1-5, L4)`);
  console.log(`${sport} card with records and streaks rendered properly.`);
}

testCards('sabres.html', sabresHtml, 'Nhl');
testCards('bills.html', billsHtml, 'Nfl');

if (errors > 0) {
  console.error(`\nCard tests failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('\nAll card rendering tests passed successfully.');
}
