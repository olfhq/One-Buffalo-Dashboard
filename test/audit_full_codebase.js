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

// 4. Shared Architecture, Service Worker & WAI-ARIA Accessibility Audit
if (!fs.existsSync('assets/shared.css')) {
  issues.push('Missing shared stylesheet: assets/shared.css');
}
if (!fs.existsSync('assets/shared.js')) {
  issues.push('Missing shared script: assets/shared.js');
}

const swContent = fs.readFileSync('sw.js', 'utf8');
if (!swContent.includes('./assets/shared.css') || !swContent.includes('./assets/shared.js')) {
  issues.push('sw.js PRECACHE_ASSETS must include ./assets/shared.css and ./assets/shared.js');
}

const workflowContent = fs.readFileSync('.github/workflows/update.yml', 'utf8');
if (!workflowContent.includes('npm ci') || !workflowContent.includes("cache: 'npm'")) {
  issues.push('.github/workflows/update.yml must use npm ci and npm caching');
}

const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
if (gitignoreContent.includes('package-lock.json')) {
  issues.push('.gitignore should not ignore package-lock.json');
}

const dataJson = JSON.parse(fs.readFileSync('data.json', 'utf8'));
if (dataJson.bills?.rootingGuide || dataJson.sabres?.rootingGuide) {
  issues.push('data.json still contains deprecated rootingGuide arrays');
}
if (!dataJson.sabres?.cutlinePoints) {
  issues.push('data.json sabres object is missing cutlinePoints');
}

pages.forEach(page => {
  const content = fs.readFileSync(page, 'utf8');
  const $ = cheerio.load(content);

  if ($('link[href="./assets/shared.css"]').length === 0) {
    issues.push(`${page} is missing <link rel="stylesheet" href="./assets/shared.css">`);
  }
  if ($('script[src="./assets/shared.js"]').length === 0) {
    issues.push(`${page} is missing <script src="./assets/shared.js">`);
  }
  if ($('#update-status').attr('aria-live') !== 'polite') {
    issues.push(`${page} #update-status is missing aria-live="polite"`);
  }

  if (page === 'bills.html' || page === 'sabres.html') {
    const tablist = $('[role="tablist"]');
    if (tablist.length === 0) {
      issues.push(`${page} is missing [role="tablist"] navigation`);
    }
    const tabs = $('[role="tab"]');
    if (tabs.length !== 3) {
      issues.push(`${page} should have 3 [role="tab"] buttons, found ${tabs.length}`);
    }
    const activeTab = $('[role="tab"][aria-selected="true"]');
    if (activeTab.attr('tabindex') !== '0') {
      issues.push(`${page} active tab must have tabindex="0"`);
    }
    $('[role="tab"][aria-selected="false"]').each((_, el) => {
      if ($(el).attr('tabindex') !== '-1') {
        issues.push(`${page} inactive tab ${$(el).attr('id')} must have tabindex="-1"`);
      }
    });
    $('.slate-filter-btn').each((_, el) => {
      const pressed = $(el).attr('aria-pressed');
      if (pressed !== 'true' && pressed !== 'false') {
        issues.push(`${page} .slate-filter-btn ${$(el).attr('id')} is missing aria-pressed attribute`);
      }
    });
  }
});

// 5. Verify Tale of the Tape & Proportional Seed Distribution Helpers in assets/shared.js
try {
  const sharedJs = fs.readFileSync('assets/shared.js', 'utf8');
  const fnCompare = sharedJs.match(/function compareEfficiencyRow\([\s\S]*?^    \}/m)[0];
  const fnRenderEff = sharedJs.match(/function renderEfficiencyRows\([\s\S]*?^    \}/m)[0];
  const fnRenderDist = sharedJs.match(/function renderSeedDistribution\([\s\S]*?^    \}/m)[0];
  eval(fnCompare);
  eval(fnRenderEff);
  eval(fnRenderDist);

  const effHtml = renderEfficiencyRows([
    { metric: 'Points Per Game', bills: '26.9 PPG (6th)', opp: '23.8 PPG (14th)' },
    { metric: 'Points Allowed', bills: '21.5 PPG (12th)', opp: '17.9 PPG (2nd)' }
  ], 'bills');
  if (!effHtml.includes('intel-col-buf intel-edge-win') || !effHtml.includes('intel-col-opp intel-edge-win')) {
    issues.push('renderEfficiencyRows failed to highlight statistical leader on each row');
  }

  const distHtml = renderSeedDistribution([
    { seed: 'Seed #1', pct: 3 },
    { seed: 'Seed #2', pct: 10 }
  ], 'dist-fill-sabres');
  if (!distHtml.includes('width: 40%') || !distHtml.includes('dist-row-leader')) {
    issues.push('renderSeedDistribution failed to proportionally scale low-percentage bars');
  }
} catch (err) {
  issues.push(`Failed evaluating shared.js helpers: ${err.message}`);
}

console.log('Accessibility & Shared Architecture Audit complete. Issues so far:', issues.length);

// 6. Global Canned Themes & Central Control Verification (Tier #3)
try {
  const sharedCss = fs.readFileSync('assets/shared.css', 'utf8');
  const sharedJs = fs.readFileSync('assets/shared.js', 'utf8');
  const expectedThemes = ['regular', 'goathead', 'snow-game', 'heritage', 'gameday', 'halloween', 'christmas', 'new-years'];
  const requiredTokens = [
    '--bg-canvas',
    '--surface-card',
    '--surface-inset',
    '--border-subtle',
    '--radius-card',
    '--font-display',
    '--font-data',
    '--bills-accent',
    '--sabres-accent'
  ];

  expectedThemes.forEach(theme => {
    const selector = `html[data-theme="${theme}"]`;
    if (!sharedCss.includes(selector)) {
      issues.push(`assets/shared.css missing required theme selector: ${selector}`);
    }
  });

  requiredTokens.forEach(token => {
    if (!sharedCss.includes(token)) {
      issues.push(`assets/shared.css missing required theme design token: ${token}`);
    }
  });

  // Verify atmospheric and telemetry animations
  const requiredKeyframes = [
    'live-radar-ping',
    'snow-drift',
    'stadium-lights-sway',
    'spooky-flicker',
    'holiday-twinkle',
    'gold-shimmer-sweep'
  ];
  requiredKeyframes.forEach(kf => {
    if (!sharedCss.includes(`@keyframes ${kf}`)) {
      issues.push(`assets/shared.css missing required animation @keyframes: ${kf}`);
    }
  });

  if (!sharedCss.includes('prefers-reduced-motion: reduce')) {
    issues.push('assets/shared.css missing prefers-reduced-motion accessibility media query');
  }

  const dataJson = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  if (!('theme' in dataJson)) {
    issues.push('data.json missing "theme" attribute');
  }
  if (!('themeUntil' in dataJson)) {
    issues.push('data.json missing "themeUntil" attribute');
  }

  pages.forEach(page => {
    const html = fs.readFileSync(page, 'utf8');
    const $ = cheerio.load(html);
    const rootTheme = $('html').attr('data-theme');
    if (!rootTheme) {
      issues.push(`${page} <html> tag is missing data-theme attribute`);
    }

    const fontsLink = $('link[href*="Barlow+Condensed"][href*="JetBrains+Mono"]');
    if (fontsLink.length === 0) {
      issues.push(`${page} is missing Google Fonts link for Barlow Condensed and JetBrains Mono`);
    }

    if (!html.includes('applyTheme(data.theme, data.themeUntil)')) {
      issues.push(`${page} does not call applyTheme(data.theme, data.themeUntil) in loadData()`);
    }

    // Constraint: NO client-side switcher UI or localStorage overrides
    if ($('#theme-select').length > 0 || $('.theme-switcher').length > 0 || $('#theme-toggle').length > 0) {
      issues.push(`${page} contains forbidden client-side theme switcher UI elements`);
    }
    if (html.includes("localStorage.getItem('theme')") || html.includes('localStorage.setItem("theme"')) {
      issues.push(`${page} contains forbidden localStorage theme overrides`);
    }
  });

  // Verify applyTheme functional execution
  const applyThemeMatch = sharedJs.match(/(const VALID_THEMES =[\s\S]*?function applyTheme\([\s\S]*?^    \})/m);
  if (!applyThemeMatch) {
    issues.push('assets/shared.js missing applyTheme function');
  } else {
    // Mock environment for testing applyTheme logic
    let mockRootTheme = null;
    let mockMetaColor = null;
    const mockDocument = {
      documentElement: {
        setAttribute: (attr, val) => { if (attr === 'data-theme') mockRootTheme = val; },
        getAttribute: (attr) => attr === 'data-theme' ? mockRootTheme : null
      },
      querySelector: (sel) => {
        if (sel === 'meta[name="theme-color"]') {
          return {
            setAttribute: (attr, val) => { if (attr === 'content') mockMetaColor = val; },
            getAttribute: (attr) => attr === 'content' ? mockMetaColor : null
          };
        }
        return null;
      }
    };

    const fnText = applyThemeMatch[1];
    const testApplyTheme = new Function('document', 'Date', `${fnText}; return applyTheme;`)(mockDocument, Date);

    // 1. Valid theme
    testApplyTheme('goathead');
    if (mockRootTheme !== 'goathead') {
      issues.push(`applyTheme('goathead') did not set data-theme="goathead", got "${mockRootTheme}"`);
    }

    // 2. Fallback on invalid theme
    testApplyTheme('non-existent-theme');
    if (mockRootTheme !== 'regular') {
      issues.push(`applyTheme('non-existent-theme') did not fallback to "regular", got "${mockRootTheme}"`);
    }

    // 3. Expiration in past
    testApplyTheme('christmas', '2020-01-01T00:00:00Z');
    if (mockRootTheme !== 'regular') {
      issues.push(`applyTheme with expired timestamp did not fallback to "regular", got "${mockRootTheme}"`);
    }

    // 4. Future expiration preserves theme
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    testApplyTheme('snow-game', futureDate);
    if (mockRootTheme !== 'snow-game') {
      issues.push(`applyTheme with future timestamp failed to apply "snow-game", got "${mockRootTheme}"`);
    }
  }
} catch (err) {
  issues.push(`Theme architecture test failed: ${err.message}`);
}

console.log('Global Canned Themes Audit complete. Issues so far:', issues.length);

if (issues.length > 0) {
  console.error('\nIssues found:');
  issues.forEach(i => console.error('  [!] ' + i));
  process.exit(1);
} else {
  console.log('\nAll codebase structural checks passed successfully!');
}
