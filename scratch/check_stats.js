const fs = require('fs');

function checkInitialHtml(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  console.log('=== ' + filename + ' INITIAL VALUES ===');
  const ids = [
    'bills-playoff-pct', 'bills-div-pct', 'bills-bye-pct', 'bills-magic-num', 'bills-win-chance',
    'sabres-playoff-pct', 'sabres-div-pct', 'sabres-wildcard-pct', 'sabres-tragic-num', 'sabres-win-chance'
  ];
  ids.forEach(id => {
    const re = new RegExp('id=[\"\']' + id + '[\"\'][^>]*>([^<]*)<', 'i');
    const m = content.match(re);
    if (m) console.log(id + ':', m[1].trim());
  });
}

checkInitialHtml('index.html');
checkInitialHtml('bills.html');
checkInitialHtml('sabres.html');
