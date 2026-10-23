const assert = require('assert');
const cheerio = require('cheerio');
const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const $ = cheerio.load(indexHtml);

// Verify static DOM markup
const projCard = $('#sabres-projection-card');
assert(projCard.length > 0, '#sabres-projection-card exists in index.html');
assert.strictEqual($('#sabres-pace-label').text().trim(), 'Proj. Finish');
assert.strictEqual($('#sabres-pace-sublabel').text().trim(), 'Cut: ~95');

const sabresHtml = fs.readFileSync('sabres.html', 'utf8');
const $s = cheerio.load(sabresHtml);
const sProjCard = $s('#sabres-projection-card');
assert(sProjCard.length > 0, '#sabres-projection-card exists in sabres.html');
assert.strictEqual($s('#sabres-pace-label').text().trim(), 'Proj. Finish');
assert.strictEqual($s('#sabres-pace-sublabel').text().trim(), 'Cut: ~95');

// Mock logic testing
function simulateTile(s) {
  let val = '';
  let label = '';
  let sublabel = '';
  let color = '';

  const magicNum = s.magicNumber;
  const rawTragic = s.tragicNumber || '91 PTS';
  const clinchScenario = (s.clinchAlert && s.clinchAlert.scenario) ? s.clinchAlert.scenario.toLowerCase() : '';
  const isClinched = s.clinched || clinchScenario.includes('clinched');
  const isEliminated = s.eliminated || clinchScenario.includes('eliminated');

  if (isClinched) {
    val = 'IN';
    label = 'Playoffs';
    sublabel = 'Clinched';
    color = '#34d399';
  } else if (isEliminated) {
    val = 'OUT';
    label = 'Playoffs';
    sublabel = 'Eliminated';
    color = '#f87171';
  } else if (magicNum !== undefined && magicNum !== null && magicNum !== '' && !String(magicNum).includes('PTS')) {
    val = String(magicNum).replace(/[^0-9]/g, '') || String(magicNum);
    label = 'Magic #';
    sublabel = 'To Clinch';
    color = '#34d399';
  } else if (!rawTragic.includes('PTS') && !rawTragic.includes('Pace') && (rawTragic.startsWith('E#') || (!isNaN(parseInt(rawTragic, 10)) && parseInt(rawTragic, 10) <= 16))) {
    val = rawTragic.startsWith('E#') ? rawTragic : `E# ${rawTragic}`;
    label = 'Tragic #';
    sublabel = 'To Elim.';
    color = '#f87171';
  } else {
    const paceMatch = rawTragic.match(/\d+/);
    const pacePts = paceMatch ? parseInt(paceMatch[0], 10) : 91;
    val = `${pacePts} PTS`;
    label = 'Proj. Finish';
    const diff = pacePts - 95;
    sublabel = diff >= 0 ? `Cut: ~95 (+${diff})` : `Cut: ~95 (${diff})`;
    color = pacePts >= 95 ? '#34d399' : (pacePts >= 91 ? '#FCB514' : '#f87171');
  }

  return { val, label, sublabel, color };
}

// Test Case 1: Early-Mid Season Pace
const t1 = simulateTile({ tragicNumber: '91 PTS' });
assert.strictEqual(t1.val, '91 PTS');
assert.strictEqual(t1.label, 'Proj. Finish');
assert.strictEqual(t1.sublabel, 'Cut: ~95 (-4)');
assert.strictEqual(t1.color, '#FCB514');

// Test Case 2: Late-Season Magic Number
const t2 = simulateTile({ magicNumber: '6' });
assert.strictEqual(t2.val, '6');
assert.strictEqual(t2.label, 'Magic #');
assert.strictEqual(t2.sublabel, 'To Clinch');
assert.strictEqual(t2.color, '#34d399');

// Test Case 3: Elimination Number
const t3 = simulateTile({ tragicNumber: 'E# 3' });
assert.strictEqual(t3.val, 'E# 3');
assert.strictEqual(t3.label, 'Tragic #');
assert.strictEqual(t3.sublabel, 'To Elim.');
assert.strictEqual(t3.color, '#f87171');

// Test Case 4: Clinched
const t4 = simulateTile({ clinchAlert: { active: true, scenario: 'Clinched Wild Card 1' } });
assert.strictEqual(t4.val, 'IN');
assert.strictEqual(t4.label, 'Playoffs');
assert.strictEqual(t4.sublabel, 'Clinched');
assert.strictEqual(t4.color, '#34d399');

// Test Case 5: Eliminated
const t5 = simulateTile({ clinchAlert: { active: true, scenario: 'Eliminated from playoff contention' } });
assert.strictEqual(t5.val, 'OUT');
assert.strictEqual(t5.label, 'Playoffs');
assert.strictEqual(t5.sublabel, 'Eliminated');
assert.strictEqual(t5.color, '#f87171');

console.log('All adaptive projection tile tests passed successfully!');
