const fs = require('fs');
const cheerio = require('cheerio');

console.log('=== FULL CODEBASE AUDIT ===\n');
let issues = [];

const pages = ['index.html', 'bills.html', 'sabres.html'];

// 1. Check Links and Navigation
pages.forEach(page => {
  const content = fs.readFileSync(page, 'utf8');
  const $ = cheerio.load(content);

  // Check <a> links
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#') || href.startsWith('mailto:')) {
      return;
    }
    const cleanHref = href.split('?')[0].split('#')[0];
    if (cleanHref && !fs.existsSync(cleanHref)) {
      issues.push(`Broken link in ${page}: href="${href}" file does not exist!`);
    }
  });

  // Check <img> sources
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) {
      issues.push(`Image without src in ${page}: ${$.html(el).slice(0, 50)}`);
      return;
    }
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      return;
    }
    const cleanSrc = src.split('?')[0].split('#')[0];
    if (cleanSrc && !fs.existsSync(cleanSrc)) {
      issues.push(`Broken local image in ${page}: src="${src}" file does not exist!`);
    }
  });

  // Check stylesheet and meta links
  $('link').each((_, el) => {
    const rel = $(el).attr('rel');
    const href = $(el).attr('href');
    if (href && !href.startsWith('http') && !href.startsWith('data:')) {
      const cleanHref = href.split('?')[0].split('#')[0];
      if (cleanHref && !fs.existsSync(cleanHref)) {
        issues.push(`Broken link[rel="${rel}"] in ${page}: href="${href}" file does not exist!`);
      }
    }
  });
});

console.log('Link & Asset Audit complete. Issues so far:', issues.length);

// 2. Check CSS Syntax & Balance in <style>
pages.forEach(page => {
  const content = fs.readFileSync(page, 'utf8');
  const $ = cheerio.load(content);
  $('style').each((i, el) => {
    const css = $(el).html();
    const openBraces = (css.match(/\{/g) || []).length;
    const closeBraces = (css.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(`Mismatched braces in ${page} <style> #${i+1}: { = ${openBraces}, } = ${closeBraces}`);
    }
  });
});

console.log('CSS Balance Audit complete. Issues so far:', issues.length);

// 3. Check for raw undefined, NaN, or null in HTML templates
pages.forEach(page => {
  const content = fs.readFileSync(page, 'utf8');
  const $ = cheerio.load(content);
  $('script, style').remove();
  const text = $('body').text();
  const rawUndefined = text.match(/\bundefined\b/gi);
  const rawNaN = text.match(/\bNaN\b/g);
  const rawNull = text.match(/\bnull\b/g);

  if (rawUndefined) issues.push(`Found "undefined" text in static body of ${page}`);
  if (rawNaN) issues.push(`Found "NaN" text in static body of ${page}`);
  if (rawNull) issues.push(`Found "null" text in static body of ${page}`);
});

console.log('Static text audit complete. Issues so far:', issues.length);

if (issues.length > 0) {
  console.error('\nIssues found:');
  issues.forEach(i => console.error('  [!] ' + i));
  process.exit(1);
} else {
  console.log('\nAll codebase structural checks passed successfully!');
}
