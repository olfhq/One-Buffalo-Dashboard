const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

console.log('=== BILLS & OPPONENT RECORDS IN DATA.JSON ===');
console.log('Bills nextGame records:', data.bills.nextGame.matchupRecords);
console.log('Bills nextGame opponent short name:', data.bills.nextGame.oppShortName);

// Check if any other place mentions Bills or Ravens records
const billsHtml = fs.readFileSync('bills.html', 'utf8');
const sabresHtml = fs.readFileSync('sabres.html', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');

function findRecords(html, name) {
  const matches = html.match(new RegExp(name + '[^<.,;]*?\\(\\d+-\\d+(?:-\\d+)?(?:,[^)]*)?\\)', 'gi')) || [];
  return Array.from(new Set(matches));
}

console.log('Bills records in bills.html:', findRecords(billsHtml, 'Bills'));
console.log('Bills records in index.html:', findRecords(indexHtml, 'Bills'));

console.log('=== SABRES & OPPONENT RECORDS IN DATA.JSON ===');
console.log('Sabres nextGame records:', data.sabres.nextGame.matchupRecords);
console.log('Sabres nextGame opponent short name:', data.sabres.nextGame.oppShortName);

console.log('Sabres records in sabres.html:', findRecords(sabresHtml, 'Sabres'));
console.log('Sabres records in index.html:', findRecords(indexHtml, 'Sabres'));
