const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const billsHtml = fs.readFileSync('bills.html', 'utf8');
const sabresHtml = fs.readFileSync('sabres.html', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');

function extractFallback(html) {
  const m = html.match(/const\s+FALLBACK_DATA\s*=\s*(\{[\s\S]*?\n\s*\};)/);
  if (m) {
    let raw = m[1].trim();
    if (raw.endsWith(';')) raw = raw.slice(0, -1);
    return JSON.parse(raw);
  }
  const m2 = html.match(/const\s+FALLBACK_DATA\s*=\s*(\{[\s\S]*?\});\s*(?:try|const|let|var|if)/);
  if (m2) {
    return JSON.parse(m2[1]);
  }
  return null;
}

const fbBills = extractFallback(billsHtml);
const fbSabres = extractFallback(sabresHtml);
const fbIndex = extractFallback(indexHtml);

function diffObj(path, o1, o2, name) {
  if (typeof o1 !== typeof o2) {
    console.log(`[DIFF ${name}] at ${path}: type mismatch ${typeof o1} vs ${typeof o2}`);
    return;
  }
  if (typeof o1 === 'object' && o1 !== null && o2 !== null) {
    const keys = Array.from(new Set([...Object.keys(o1), ...Object.keys(o2)]));
    for (const k of keys) {
      if (path === '' && (k === 'updatedAt' || k === 'outOfTownGames')) continue; // ignore timestamp and large arrays for deep diff
      diffObj(path ? `${path}.${k}` : k, o1[k], o2[k], name);
    }
  } else if (o1 !== o2) {
    console.log(`[DIFF ${name}] at ${path}: data.json = ${JSON.stringify(o1)} vs ${JSON.stringify(o2)}`);
  }
}

console.log('--- Diffing bills.html fallback against data.json ---');
diffObj('', data, fbBills, 'bills.html');

console.log('--- Diffing sabres.html fallback against data.json ---');
diffObj('', data, fbSabres, 'sabres.html');

console.log('--- Diffing index.html fallback against data.json ---');
diffObj('', data, fbIndex, 'index.html');
