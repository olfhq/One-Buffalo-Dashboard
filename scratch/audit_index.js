const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
const ids = new Set();
let match;
while ((match = regex.exec(html)) !== null) {
  ids.add(match[1]);
}

console.log('Unique element IDs manipulated in index.html:');
console.log(Array.from(ids).sort().join('\n'));
