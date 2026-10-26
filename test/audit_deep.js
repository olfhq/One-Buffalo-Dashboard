const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
let errors = 0;

console.log('=== CHECKING EFFICIENCY STATS ===');
console.log('Bills efficiency count:', data.bills.nextGame.efficiency?.length || 0);
if (!data.bills.nextGame.efficiency || data.bills.nextGame.efficiency.length < 6) {
  console.error('FAIL: Bills efficiency count is less than 6');
  errors++;
} else {
  data.bills.nextGame.efficiency.forEach(e => {
    console.log(`  ${e.metric}: Bills ${e.bills} vs Opp ${e.opp}`);
  });
}

console.log('\nSabres efficiency count:', data.sabres.nextGame.efficiency?.length || 0);
if (!data.sabres.nextGame.efficiency || data.sabres.nextGame.efficiency.length < 6) {
  console.error('FAIL: Sabres efficiency count is less than 6');
  errors++;
} else {
  data.sabres.nextGame.efficiency.forEach(e => {
    console.log(`  ${e.metric}: Sabres ${e.sabres} vs Opp ${e.opp}`);
  });
}

console.log('\n=== CHECKING COUNTDOWN ISO TIMESTAMPS ===');
if (!data.bills.nextGame.isoTime || isNaN(new Date(data.bills.nextGame.isoTime).getTime())) {
  console.error('FAIL: Bills nextGame.isoTime is invalid or missing:', data.bills.nextGame.isoTime);
  errors++;
} else {
  console.log('Bills nextGame.isoTime is valid:', data.bills.nextGame.isoTime);
}

if (!data.sabres.nextGame.isoTime || isNaN(new Date(data.sabres.nextGame.isoTime).getTime())) {
  console.error('FAIL: Sabres nextGame.isoTime is invalid or missing:', data.sabres.nextGame.isoTime);
  errors++;
} else {
  console.log('Sabres nextGame.isoTime is valid:', data.sabres.nextGame.isoTime);
}

console.log('\n=== CHECKING INJURIES ===');
console.log('Bills injuries count:', data.bills.nextGame.injuries?.length || 0);
console.log('Sabres injuries count:', data.sabres.nextGame.injuries?.length || 0);

if (!data.bills.nextGame.injuries || data.bills.nextGame.injuries.length === 0) {
  console.error('FAIL: Bills injuries list is empty');
  errors++;
}
if (!data.sabres.nextGame.injuries || data.sabres.nextGame.injuries.length === 0) {
  console.error('FAIL: Sabres injuries list is empty');
  errors++;
} else if (data.sabres.nextGame.injuries.some(i => i.player === 'Roster Reserve')) {
  console.error('FAIL: Sabres injuries contains hardcoded placeholder "Roster Reserve"');
  errors++;
}

console.log('\n=== CHECKING 1ST ROUND PLAYOFF OPPONENTS & SPECIAL TEAMS / TURNOVER RATIO ===');
if (!Array.isArray(data.bills.opponents) || data.bills.opponents.length < 3) {
  console.error('FAIL: Bills 1st-round opponents list is missing or < 3');
  errors++;
} else {
  console.log('Bills 1st-round opponents:', data.bills.opponents.map(o => `${o.team} (${o.pct}%)`).join(', '));
}

if (!Array.isArray(data.sabres.opponents) || data.sabres.opponents.length < 3) {
  console.error('FAIL: Sabres 1st-round opponents list is missing or < 3');
  errors++;
} else {
  console.log('Sabres 1st-round opponents:', data.sabres.opponents.map(o => `${o.team} (${o.pct}%)`).join(', '));
}

if (!data.bills.nextGame.turnoverRatio?.bills || !data.bills.nextGame.turnoverRatio?.opp) {
  console.error('FAIL: Bills turnoverRatio missing');
  errors++;
}
if (!data.sabres.nextGame.specialTeams?.sabres || !data.sabres.nextGame.specialTeams?.opp) {
  console.error('FAIL: Sabres specialTeams missing');
  errors++;
}

console.log('\n=== CHECKING ROOTING GUIDE VS OUT OF TOWN GAMES ===');
if (!data.sabres.outOfTownGames || data.sabres.outOfTownGames.length === 0) {
  console.error('FAIL: Sabres out of town games list is empty');
  errors++;
} else {
  data.sabres.outOfTownGames.forEach((g, i) => {
    if (!g.impactClass || !g.verdict || !g.target) {
      console.error(`FAIL: Sabres game ${i} missing verdict/impact/target:`, g.awayName, '@', g.homeName);
      errors++;
    }
  });
  console.log('Sabres out of town games all have valid impactClass, verdict, target.');
}

if (!data.bills.outOfTownGames || data.bills.outOfTownGames.length === 0) {
  console.error('FAIL: Bills out of town games list is empty');
  errors++;
} else {
  data.bills.outOfTownGames.forEach((g, i) => {
    if (!g.impactClass || !g.verdict || !g.target) {
      console.error(`FAIL: Bills game ${i} missing verdict/impact/target:`, g.awayName, '@', g.homeName);
      errors++;
    }
  });
  console.log('Bills out of town games all have valid impactClass, verdict, target.');
}

if (errors > 0) {
  console.error(`\nTest failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('\nDeep audit passed successfully.');
}
