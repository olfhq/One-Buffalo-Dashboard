const fs = require('fs');

const dataStr = fs.readFileSync('data.json', 'utf8').trim();
const files = ['index.html', 'bills.html', 'sabres.html'];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const startMarker = 'const FALLBACK_DATA =';
  const endMarker = 'try {';

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker, startIdx);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Markers not found in ${file}`);
  }

  const newFallback = `const FALLBACK_DATA = ${dataStr};\n\n      `;
  const updatedContent = content.slice(0, startIdx) + newFallback + content.slice(endIdx);
  fs.writeFileSync(file, updatedContent, 'utf8');
  console.log(`Updated FALLBACK_DATA in ${file}`);
});
