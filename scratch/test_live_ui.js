const fs = require('fs');

const sabresHtml = fs.readFileSync('sabres.html', 'utf8');
const billsHtml = fs.readFileSync('bills.html', 'utf8');

// Check that the new IDs exist in the HTML strings
const checkIds = [
  { file: 'sabres.html', id: 'sabres-radar-live-chance' },
  { file: 'sabres.html', id: 'sabres-radar-live-date' },
  { file: 'sabres.html', id: 'sabres-radar-live-score' },
  { file: 'sabres.html', id: 'sabres-radar-live-clock' },
  { file: 'sabres.html', id: 'sabres-win-chance' },
  { file: 'sabres.html', id: 'pinned-sabres-win-chance' },
  { file: 'bills.html', id: 'bills-radar-live-chance' },
  { file: 'bills.html', id: 'bills-radar-live-date' },
  { file: 'bills.html', id: 'bills-radar-live-score' },
  { file: 'bills.html', id: 'bills-radar-live-clock' },
  { file: 'bills.html', id: 'bills-win-chance' },
  { file: 'bills.html', id: 'pinned-bills-win-chance' }
];

let allPassed = true;
checkIds.forEach(({ file, id }) => {
  const content = file === 'sabres.html' ? sabresHtml : billsHtml;
  if (!content.includes(`id=\"${id}\"`) && !content.includes(`id='${id}'`)) {
    console.error(`FAILED: ${file} does not contain id="${id}"`);
    allPassed = false;
  } else {
    console.log(`PASSED: ${file} contains id="${id}"`);
  }
});

if (allPassed) {
  console.log('\nAll live game IDs across Tab 1, Tab 2, and Tab 3 verified successfully!');
}
