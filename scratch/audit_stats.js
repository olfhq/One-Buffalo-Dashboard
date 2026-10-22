const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const billsHtml = fs.readFileSync('bills.html', 'utf8');
const sabresHtml = fs.readFileSync('sabres.html', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');

const findings = [];

function check(label, condition, detail) {
  if (!condition) {
    findings.push({ label, status: 'FAIL', detail });
  } else {
    findings.push({ label, status: 'PASS', detail });
  }
}

// 1. BILLS DATA.JSON INTERNAL CONSISTENCY
const b = data.bills;
const bSeedSum = b.seedDistribution.reduce((acc, s) => acc + (s.pct || 0), 0);
check('Bills playoff odds vs seed sum', Math.abs(b.makePlayoffs - bSeedSum) <= 1, `makePlayoffs=${b.makePlayoffs}, seedSum=${bSeedSum}`);
check('Bills leverage calculation', b.nextGame.leverage === Math.abs(b.nextGame.ifWin - b.nextGame.ifLoss), `leverage=${b.nextGame.leverage}, diff=${Math.abs(b.nextGame.ifWin - b.nextGame.ifLoss)}`);

// Bills division radar vs winDivision
const billsRadarTeam = b.divisionRadar.find(t => t.team === 'Bills');
check('Bills division radar contains Bills', !!billsRadarTeam, `Found: ${JSON.stringify(billsRadarTeam)}`);
if (billsRadarTeam) {
  check('Bills winDivision matches divisionRadar pct', billsRadarTeam.pct === b.winDivision, `winDivision=${b.winDivision}, radar=${billsRadarTeam.pct}`);
}

// Bills Seed 1 vs seedDistribution #1 Seed
const bSeed1Item = b.seedDistribution.find(s => s.seed === '#1 Seed');
if (bSeed1Item) {
  check('Bills seed1 matches seedDistribution #1 Seed', b.seed1 === bSeed1Item.pct, `seed1=${b.seed1}, dist=${bSeed1Item.pct}`);
}

// 2. SABRES DATA.JSON INTERNAL CONSISTENCY
const s = data.sabres;
const sSeedSum = s.seedDistribution.reduce((acc, s) => acc + (s.pct || 0), 0);
check('Sabres playoff odds vs seed sum', Math.abs(s.makePlayoffs - sSeedSum) <= 1, `makePlayoffs=${s.makePlayoffs}, seedSum=${sSeedSum}`);
check('Sabres playoff odds = winDivision + wildcard', Math.abs(s.makePlayoffs - (s.winDivision + s.wildcard)) <= 1, `makePlayoffs=${s.makePlayoffs}, div+wc=${s.winDivision + s.wildcard}`);
check('Sabres leverage calculation', s.nextGame.leverage === Math.abs(s.nextGame.ifWin - s.nextGame.ifLoss), `leverage=${s.nextGame.leverage}, diff=${Math.abs(s.nextGame.ifWin - s.nextGame.ifLoss)}`);

// Sabres division radar
const sabresRadarTeam = s.divisionRadar.find(t => t.team === 'Sabres');
check('Sabres division radar contains Sabres', !!sabresRadarTeam, `Found: ${JSON.stringify(sabresRadarTeam)}`);
if (sabresRadarTeam) {
  check('Sabres makePlayoffs matches divisionRadar pct', sabresRadarTeam.pct === s.makePlayoffs, `makePlayoffs=${s.makePlayoffs}, radar=${sabresRadarTeam.pct}`);
}

// 3. OUT OF TOWN GAMES SCORES & VERDICTS AUDIT
console.log('Auditing Bills outOfTownGames (total ' + b.outOfTownGames.length + ')...');
b.outOfTownGames.forEach((g, idx) => {
  if (g.statusState === 'post') {
    const away = parseInt(g.awayScore, 10);
    const home = parseInt(g.homeScore, 10);
    if (isNaN(away) || isNaN(home)) {
      findings.push({ label: `Bills Game ${idx} (${g.awayName} @ ${g.homeName})`, status: 'FAIL', detail: 'Invalid score numbers' });
    }
  }
});

console.log('Auditing Sabres outOfTownGames (total ' + s.outOfTownGames.length + ')...');
s.outOfTownGames.forEach((g, idx) => {
  if (g.statusState === 'post') {
    const away = parseInt(g.awayScore, 10);
    const home = parseInt(g.homeScore, 10);
    if (isNaN(away) || isNaN(home)) {
      findings.push({ label: `Sabres Game ${idx} (${g.awayName} @ ${g.homeName})`, status: 'FAIL', detail: 'Invalid score numbers' });
    }
  }
});

// 4. CROSS-PAGE CONSISTENCY (INDEX vs BILLS vs SABRES vs DATA.JSON)
// Check FALLBACK_DATA in index.html, bills.html, sabres.html
function extractFallback(html, label) {
  const m = html.match(/const\s+FALLBACK_DATA\s*=\s*(\{[\s\S]*?\n\s*\};)/);
  if (!m) return null;
  try {
    let raw = m[1].trim();
    if (raw.endsWith(';')) raw = raw.slice(0, -1);
    return JSON.parse(raw);
  } catch (e) {
    return 'PARSE_ERROR: ' + e.message;
  }
}

const fbIndex = extractFallback(indexHtml, 'index.html');
const fbBills = extractFallback(billsHtml, 'bills.html');
const fbSabres = extractFallback(sabresHtml, 'sabres.html');

console.log('Fallback data extraction:');
console.log('index.html fallback parsed:', typeof fbIndex === 'object' && fbIndex !== null);
console.log('bills.html fallback parsed:', typeof fbBills === 'object' && fbBills !== null);
console.log('sabres.html fallback parsed:', typeof fbSabres === 'object' && fbSabres !== null);

if (typeof fbIndex === 'object' && fbIndex !== null) {
  check('index.html FALLBACK_DATA bills.makePlayoffs matches data.json', fbIndex.bills.makePlayoffs === b.makePlayoffs, `index=${fbIndex.bills.makePlayoffs}, data=${b.makePlayoffs}`);
  check('index.html FALLBACK_DATA sabres.makePlayoffs matches data.json', fbIndex.sabres.makePlayoffs === s.makePlayoffs, `index=${fbIndex.sabres.makePlayoffs}, data=${s.makePlayoffs}`);
  check('index.html FALLBACK_DATA sabres.winDivision matches data.json', fbIndex.sabres.winDivision === s.winDivision, `index=${fbIndex.sabres.winDivision}, data=${s.winDivision}`);
  check('index.html FALLBACK_DATA sabres.wildcard matches data.json', fbIndex.sabres.wildcard === s.wildcard, `index=${fbIndex.sabres.wildcard}, data=${s.wildcard}`);
}

if (typeof fbBills === 'object' && fbBills !== null) {
  check('bills.html FALLBACK_DATA bills.makePlayoffs matches data.json', fbBills.bills.makePlayoffs === b.makePlayoffs, `bills=${fbBills.bills.makePlayoffs}, data=${b.makePlayoffs}`);
  check('bills.html FALLBACK_DATA sabres.makePlayoffs matches data.json', fbBills.sabres.makePlayoffs === s.makePlayoffs, `bills=${fbBills.sabres.makePlayoffs}, data=${s.makePlayoffs}`);
}

if (typeof fbSabres === 'object' && fbSabres !== null) {
  check('sabres.html FALLBACK_DATA sabres.makePlayoffs matches data.json', fbSabres.sabres.makePlayoffs === s.makePlayoffs, `sabres=${fbSabres.sabres.makePlayoffs}, data=${s.makePlayoffs}`);
  check('sabres.html FALLBACK_DATA bills.makePlayoffs matches data.json', fbSabres.bills.makePlayoffs === b.makePlayoffs, `sabres=${fbSabres.bills.makePlayoffs}, data=${b.makePlayoffs}`);
}

console.log('\n=== AUDIT RESULTS ===');
findings.forEach(f => {
  console.log(`[${f.status}] ${f.label} (${f.detail})`);
});
