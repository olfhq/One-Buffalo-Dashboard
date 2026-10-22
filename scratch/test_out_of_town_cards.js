const fs = require('fs');

const sabresHtml = fs.readFileSync('sabres.html', 'utf8');
const billsHtml = fs.readFileSync('bills.html', 'utf8');

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
  console.log(`${sport} LIVE card contains win-prob-chip:`, liveHtml.includes('win-prob-chip'));
  console.log(`${sport} LIVE card contains card-win-pill:`, liveHtml.includes('card-win-pill'));
  console.log(`${sport} LIVE card contains win-chance-meter-wrap:`, liveHtml.includes('win-chance-meter-wrap'));

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
  console.log(`${sport} FINAL card contains 100%:`, finalHtml.includes('100%'));
  console.log(`${sport} FINAL card contains 0%:`, finalHtml.includes('0%'));

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
  console.log(`${sport} PRE card contains win-prob-chip:`, preHtml.includes('win-prob-chip'));
  console.log(`${sport} PRE card contains win-chance-meter-wrap:`, preHtml.includes('win-chance-meter-wrap'));
}

testCards('sabres.html', sabresHtml, 'Nhl');
testCards('bills.html', billsHtml, 'Nfl');
