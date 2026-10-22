const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

console.log('=== DATA.JSON DEEP AUDIT ===');
const issues = [];

// 1. BILLS
const b = data.bills;
if (!b) issues.push('Missing data.bills');
else {
  if (b.makePlayoffs < 0 || b.makePlayoffs > 100) issues.push(`Invalid b.makePlayoffs: ${b.makePlayoffs}`);
  if (b.winDivision < 0 || b.winDivision > 100) issues.push(`Invalid b.winDivision: ${b.winDivision}`);
  if (b.seed1 < 0 || b.seed1 > 100) issues.push(`Invalid b.seed1: ${b.seed1}`);
  
  // Seed distribution
  const sumSeeds = b.seedDistribution.reduce((acc, s) => acc + s.pct, 0);
  if (Math.abs(sumSeeds - b.makePlayoffs) > 1) {
    issues.push(`Bills seedDistribution sum (${sumSeeds}) does not match makePlayoffs (${b.makePlayoffs})`);
  }

  // Next game
  const ng = b.nextGame;
  if (!ng) issues.push('Missing b.nextGame');
  else {
    if (ng.leverage !== Math.abs(ng.ifWin - ng.ifLoss)) {
      issues.push(`Bills leverage (${ng.leverage}) != |ifWin (${ng.ifWin}) - ifLoss (${ng.ifLoss})|`);
    }
  }

  // Out of town games
  b.outOfTownGames.forEach((g, idx) => {
    if (!g.awayName || !g.homeName) issues.push(`Bills outOfTownGames[${idx}] missing team names`);
    if (!g.statusState) issues.push(`Bills outOfTownGames[${idx}] missing statusState`);
    if (g.statusState === 'post') {
      if (g.awayScore === undefined || g.homeScore === undefined || g.awayScore === '' || g.homeScore === '') {
        issues.push(`Bills outOfTownGames[${idx}] postgame missing scores`);
      }
    }
  });
}

// 2. SABRES
const s = data.sabres;
if (!s) issues.push('Missing data.sabres');
else {
  if (s.makePlayoffs < 0 || s.makePlayoffs > 100) issues.push(`Invalid s.makePlayoffs: ${s.makePlayoffs}`);
  if (s.winDivision < 0 || s.winDivision > 100) issues.push(`Invalid s.winDivision: ${s.winDivision}`);
  if (s.wildcard < 0 || s.wildcard > 100) issues.push(`Invalid s.wildcard: ${s.wildcard}`);
  
  if (Math.abs(s.makePlayoffs - (s.winDivision + s.wildcard)) > 1) {
    issues.push(`Sabres makePlayoffs (${s.makePlayoffs}) != winDivision (${s.winDivision}) + wildcard (${s.wildcard})`);
  }

  // Seed distribution
  const sumSeeds = s.seedDistribution.reduce((acc, s) => acc + s.pct, 0);
  if (Math.abs(sumSeeds - s.makePlayoffs) > 1) {
    issues.push(`Sabres seedDistribution sum (${sumSeeds}) does not match makePlayoffs (${s.makePlayoffs})`);
  }

  // Next game
  const ng = s.nextGame;
  if (!ng) issues.push('Missing s.nextGame');
  else {
    if (ng.leverage !== Math.abs(ng.ifWin - ng.ifLoss)) {
      issues.push(`Sabres leverage (${ng.leverage}) != |ifWin (${ng.ifWin}) - ifLoss (${ng.ifLoss})|`);
    }
  }

  // Out of town games
  s.outOfTownGames.forEach((g, idx) => {
    if (!g.awayName || !g.homeName) issues.push(`Sabres outOfTownGames[${idx}] missing team names`);
    if (!g.statusState) issues.push(`Sabres outOfTownGames[${idx}] missing statusState`);
    if (g.statusState === 'post') {
      if (g.awayScore === undefined || g.homeScore === undefined || g.awayScore === '' || g.homeScore === '') {
        issues.push(`Sabres outOfTownGames[${idx}] postgame missing scores`);
      }
    }
  });
}

console.log('Total issues found in data.json:', issues.length);
issues.forEach(i => console.log(' - ' + i));
