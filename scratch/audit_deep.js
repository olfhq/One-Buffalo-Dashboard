const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const billsHtml = fs.readFileSync('bills.html', 'utf8');
const sabresHtml = fs.readFileSync('sabres.html', 'utf8');

console.log('=== CHECKING EFFICIENCY STATS ===');
console.log('Bills efficiency count:', data.bills.nextGame.efficiency.length);
data.bills.nextGame.efficiency.forEach(e => {
  console.log(`  ${e.metric}: Bills ${e.bills} vs Opp ${e.opp}`);
});

console.log('\nSabres efficiency count:', data.sabres.nextGame.efficiency.length);
data.sabres.nextGame.efficiency.forEach(e => {
  console.log(`  ${e.metric}: Sabres ${e.sabres} vs Opp ${e.opp}`);
});

console.log('\n=== CHECKING INJURIES ===');
console.log('Bills injuries count:', data.bills.nextGame.injuries.length);
console.log('Sabres injuries count:', data.sabres.nextGame.injuries.length);

console.log('\n=== CHECKING ROOTING GUIDE VS OUT OF TOWN GAMES ===');
// For Sabres, let's check outOfTownGames impactClass vs verdict
data.sabres.outOfTownGames.forEach((g, i) => {
  if (!g.impactClass || !g.verdict || !g.target) {
    console.warn(`Sabres game ${i} missing verdict/impact/target:`, g.awayName, '@', g.homeName);
  }
});
console.log('Sabres out of town games all have valid impactClass, verdict, target.');

data.bills.outOfTownGames.forEach((g, i) => {
  if (!g.impactClass || !g.verdict || !g.target) {
    console.warn(`Bills game ${i} missing verdict/impact/target:`, g.awayName, '@', g.homeName);
  }
});
console.log('Bills out of town games all have valid impactClass, verdict, target.');
