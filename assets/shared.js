/* ==========================================================================
   ONE BUFFALO DASHBOARD — SHARED RUNTIME UTILITIES
   Shared across index.html, bills.html, and sabres.html
   ========================================================================== */

    // Unified Countdown Manager (Single Interval for All Timers)
    const activeCountdowns = new Map();
    let globalCountdownInterval = null;

    function updateAllCountdowns() {
      if (typeof document !== 'undefined' && document.hidden) return;
      const now = Date.now();
      for (const [id, targetIso] of activeCountdowns.entries()) {
        const el = document.getElementById(id);
        if (!el) {
          activeCountdowns.delete(id);
          continue;
        }
        const diff = new Date(targetIso).getTime() - now;
        if (isNaN(diff)) {
          activeCountdowns.delete(id);
          continue;
        }
        if (diff <= 0) {
          if (el.innerHTML !== '<span class="live-dot"></span> LIVE NOW') {
            el.innerHTML = '<span class="live-dot"></span> LIVE NOW';
            el.style.color = '#10b981';
          }
          activeCountdowns.delete(id);
          continue;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / 1000 / 60) % 60);
        const secs = Math.floor((diff / 1000) % 60);

        const txt = days > 0
          ? `${days}d ${hours}h ${mins}m`
          : `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (el.textContent !== txt) {
          el.textContent = txt;
        }
      }
    }

    function startCountdown(elementId, targetIso) {
      if (!elementId || !targetIso) return;
      activeCountdowns.set(elementId, targetIso);
      updateAllCountdowns();
      if (!globalCountdownInterval) {
        globalCountdownInterval = setInterval(updateAllCountdowns, 1000);
      }
    }

    function stopCountdown(elementId) {
      activeCountdowns.delete(elementId);
    }

    // Dynamic US Eastern DST Offset Helper (returns "GMT-0400" in EDT or "GMT-0500" in EST)
    function getEasternOffset(datePartOrCandidate, year) {
      try {
        const probe = (datePartOrCandidate instanceof Date)
          ? datePartOrCandidate
          : (datePartOrCandidate && year ? new Date(`${datePartOrCandidate}, ${year} 12:00:00 UTC`) : new Date());
        const validProbe = isNaN(probe.getTime()) ? new Date() : probe;
        const tzPart = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          timeZoneName: 'shortOffset'
        }).formatToParts(validProbe).find(p => p.type === 'timeZoneName');
        if (tzPart && tzPart.value) {
          const m = tzPart.value.match(/GMT([+-]\d+)/);
          if (m) {
            const hrs = parseInt(m[1], 10);
            const sign = hrs < 0 ? '-' : '+';
            return `GMT${sign}${String(Math.abs(hrs)).padStart(2, '0')}00`;
          }
        }
      } catch (e) {}
      return 'GMT-0500';
    }

    // Derive a valid ISO timestamp from a game object
    function resolveGameIso(game) {
      if (!game) return null;
      if (game.isoTime) {
        const t = new Date(game.isoTime).getTime();
        if (!isNaN(t)) return game.isoTime;
      }
      if (game.gameTime) {
        try {
          const clean = game.gameTime.replace(/^[A-Za-z]+,\s*/, '');
          const parts = clean.split('•').map(s => s.trim());
          if (parts.length === 2) {
            const curYear = new Date().getFullYear();
            const timePart = parts[1].replace(/\s*ET$/, '');
            const offset = getEasternOffset(parts[0], curYear);
            const candidateStr = `${parts[0]}, ${curYear} ${timePart} ${offset}`;
            const candidate = new Date(candidateStr);
            if (!isNaN(candidate.getTime())) {
              return candidate.toISOString();
            }
          }
        } catch (e) {}
      }
      return null;
    }

    // Real-Time In-Game Win Probability Engine (NFL Logistic Model)
    function calculateLiveNflWinChance(bufScore, oppScore, statusDetail, preGameProb = 60) {
      const buf = parseInt(bufScore) || 0;
      const opp = parseInt(oppScore) || 0;
      const diff = buf - opp;
      const detail = (statusDetail || '').toLowerCase();

      if (detail.includes('final')) {
        if (diff > 0) return 100;
        if (diff < 0) return 0;
        return 50;
      }

      let minsRemaining = 60;
      if (detail.includes('ot') || detail.includes('overtime')) {
        minsRemaining = 5.0;
      } else if (detail.includes('4') || detail.includes('4th')) {
        const match = detail.match(/(\d+):(\d+)/);
        minsRemaining = match ? Math.max(0.2, parseInt(match[1]) + parseInt(match[2]) / 60) : 7.5;
      } else if (detail.includes('3') || detail.includes('3rd')) {
        const match = detail.match(/(\d+):(\d+)/);
        minsRemaining = match ? Math.max(15.2, 15 + parseInt(match[1]) + parseInt(match[2]) / 60) : 22.5;
      } else if (detail.includes('2') || detail.includes('2nd') || detail.includes('half')) {
        minsRemaining = 30;
      } else if (detail.includes('1') || detail.includes('1st')) {
        minsRemaining = 45;
      }

      if (diff === 0 && minsRemaining <= 1.0) return 50;

      const frac = Math.max(0.005, minsRemaining / 60);
      const p0 = Math.min(0.95, Math.max(0.05, (preGameProb || 60) / 100));
      const baselineLogit = Math.log(p0 / (1 - p0));
      const sigma = Math.max(1.5, 13.5 * Math.sqrt(frac));
      const z = (baselineLogit * frac * 0.4) + (diff * 1.6 / sigma);
      const prob = 1 / (1 + Math.exp(-z));

      return Math.min(99, Math.max(1, Math.round(prob * 100)));
    }

    // Real-Time In-Game Win Probability Engine (NHL Logistic Model)
    function calculateLiveNhlWinChance(bufScore, oppScore, statusDetail, preGameProb = 52) {
      const buf = parseInt(bufScore) || 0;
      const opp = parseInt(oppScore) || 0;
      const diff = buf - opp;
      const detail = (statusDetail || '').toLowerCase();

      if (detail.includes('final')) {
        if (diff > 0) return 100;
        if (diff < 0) return 0;
        return 50;
      }

      let minsRemaining = 60;
      if (detail.includes('ot') || detail.includes('overtime') || detail.includes('so') || detail.includes('shootout')) {
        minsRemaining = 2.0;
      } else if (detail.includes('end of 2') || detail.includes('end of the 2')) {
        minsRemaining = 20.0;
      } else if (detail.includes('end of 1') || detail.includes('end of the 1')) {
        minsRemaining = 40.0;
      } else if (detail.includes('3') || detail.includes('3rd')) {
        const match = detail.match(/(\d+):(\d+)/);
        minsRemaining = match ? Math.max(0.1, parseInt(match[1]) + parseInt(match[2]) / 60) : 10;
      } else if (detail.includes('2') || detail.includes('2nd')) {
        const match = detail.match(/(\d+):(\d+)/);
        minsRemaining = match ? Math.max(20.1, 20 + parseInt(match[1]) + parseInt(match[2]) / 60) : 30;
      } else if (detail.includes('1') || detail.includes('1st')) {
        const match = detail.match(/(\d+):(\d+)/);
        minsRemaining = match ? Math.max(40.1, 40 + parseInt(match[1]) + parseInt(match[2]) / 60) : 50;
      }

      if (diff === 0 && minsRemaining <= 1.0) return 50;

      const frac = Math.max(0.005, minsRemaining / 60);
      const p0 = Math.min(0.95, Math.max(0.05, (preGameProb || 52) / 100));
      const baselineLogit = Math.log(p0 / (1 - p0));
      const sigma = Math.sqrt(0.12 * minsRemaining + 0.25);
      const z = (baselineLogit * frac * 0.5) + (diff * 1.55 / sigma);
      const prob = 1 / (1 + Math.exp(-z));

      return Math.min(99, Math.max(1, Math.round(prob * 100)));
    }

    // Adaptive 4th KPI Tile for Sabres (Clinched / Eliminated / Magic # / Tragic # / 82-Game Pace)
    function updateSabresProjectionTile(s) {
      if (!s) return;
      const valEl = document.getElementById('sabres-tragic-num');
      const labelEl = document.getElementById('sabres-pace-label');
      const sublabelEl = document.getElementById('sabres-pace-sublabel');
      const cardEl = document.getElementById('sabres-projection-card');
      if (!valEl) return;

      const magicNum = s.magicNumber;
      const rawTragic = s.tragicNumber || '91 PTS';
      const clinchScenario = (s.clinchAlert && s.clinchAlert.scenario) ? s.clinchAlert.scenario.toLowerCase() : '';
      const isClinched = s.clinched || clinchScenario.includes('clinched');
      const isEliminated = s.eliminated || clinchScenario.includes('eliminated');

      // 1. Clinched postseason
      if (isClinched) {
        valEl.textContent = 'IN';
        valEl.style.color = '#34d399';
        if (labelEl) labelEl.textContent = 'Playoffs';
        if (sublabelEl) sublabelEl.textContent = 'Clinched';
        if (cardEl) cardEl.title = 'Buffalo has clinched an NHL playoff berth!';
        return;
      }

      // 2. Eliminated from contention
      if (isEliminated) {
        valEl.textContent = 'OUT';
        valEl.style.color = '#f87171';
        if (labelEl) labelEl.textContent = 'Playoffs';
        if (sublabelEl) sublabelEl.textContent = 'Eliminated';
        if (cardEl) cardEl.title = 'Buffalo is mathematically eliminated from playoff contention.';
        return;
      }

      // 3. Late-season Clinching Hunt (Magic Number active)
      const hasValidMagic = magicNum !== undefined && magicNum !== null && magicNum !== '' && !String(magicNum).includes('PTS');
      if (hasValidMagic) {
        const cleanMagic = String(magicNum).replace(/[^0-9]/g, '') || magicNum;
        valEl.textContent = cleanMagic;
        valEl.style.color = '#34d399';
        if (labelEl) labelEl.textContent = 'Magic #';
        if (sublabelEl) sublabelEl.textContent = 'To Clinch';
        if (cardEl) cardEl.title = 'Combined Sabres wins and chaser losses required to mathematically clinch a playoff berth.';
        return;
      }

      // 4. Late-season Elimination Danger (Tragic / Elimination Number)
      const isTragicNumber = !rawTragic.includes('PTS') && !rawTragic.includes('Pace') && (rawTragic.startsWith('E#') || (!isNaN(parseInt(rawTragic, 10)) && parseInt(rawTragic, 10) <= 16));
      if (isTragicNumber) {
        valEl.textContent = rawTragic.startsWith('E#') ? rawTragic : `E# ${rawTragic}`;
        valEl.style.color = '#f87171';
        if (labelEl) labelEl.textContent = 'Tragic #';
        if (sublabelEl) sublabelEl.textContent = 'To Elim.';
        if (cardEl) cardEl.title = 'Combined Sabres dropped points and competitor points gained before mathematical elimination.';
        return;
      }

      // 5. Early & Mid-Season Default: Projected Finish (82-Game Pace)
      const paceMatch = rawTragic.match(/\d+/);
      const pacePts = paceMatch ? parseInt(paceMatch[0], 10) : 91;
      const cutline = Number(s.cutlinePoints) || 95;
      valEl.textContent = `${pacePts} PTS`;

      if (pacePts >= cutline) {
        valEl.style.color = '#34d399';
      } else if (pacePts >= cutline - 4) {
        valEl.style.color = '#FCB514';
      } else {
        valEl.style.color = '#f87171';
      }

      if (labelEl) labelEl.textContent = 'Proj. Finish';
      if (sublabelEl) {
        const diff = pacePts - cutline;
        sublabelEl.textContent = diff >= 0 ? `Cut: ~${cutline} (+${diff})` : `Cut: ~${cutline} (${diff})`;
      }
      if (cardEl) {
        cardEl.title = `Projected 82-game regular season finish (${pacePts} pts) based on current points pace. Eastern Conference playoff cutline is ~${cutline} pts.`;
      }
    }

    // Centralized Multi-Tier Canned Theme Engine (Global Atmosphere + Independent Team Overrides)
    const VALID_THEMES = [
      'regular',
      '90s-nostalgia',
      'the-aud-era',
      'snow-game',
      'gameday',
      'halloween',
      'thanksgiving',
      'christmas',
      'new-years',
      // Backward-compatibility aliases
      'goathead',
      'heritage'
    ];

    const VALID_BILLS_OVERRIDES = ['regular', 'red-helmet', 'standing-buffalo', 'gameday'];
    const VALID_SABRES_OVERRIDES = ['regular', 'goathead', 'french-connection', 'gameday'];

    const THEME_COLORS = {
      'regular': '#080a0f',
      '90s-nostalgia': '#060606',
      'the-aud-era': '#051329',
      'snow-game': '#060f1c',
      'gameday': '#020617',
      'halloween': '#09050e',
      'thanksgiving': '#0c0704',
      'christmas': '#030e07',
      'new-years': '#0a0907',
      'goathead': '#060606',
      'heritage': '#051329',
      'red-helmet': '#060b14',
      'standing-buffalo': '#05101f',
      'french-connection': '#051329'
    };

    function applyTheme(globalTheme, billsOverride, sabresOverride, themeUntil) {
      if (typeof document === 'undefined') return { globalTheme: 'regular' };

      let targetGlobal = (globalTheme || '').toLowerCase().trim();
      let targetBills = billsOverride ? (billsOverride || '').toLowerCase().trim() : null;
      let targetSabres = sabresOverride ? (sabresOverride || '').toLowerCase().trim() : null;

      // Auto-revert check: Total reset if expired
      if (themeUntil) {
        const exp = new Date(themeUntil).getTime();
        if (!isNaN(exp) && Date.now() > exp) {
          targetGlobal = 'regular';
          targetBills = null;
          targetSabres = null;
        }
      }

      if (!VALID_THEMES.includes(targetGlobal)) {
        targetGlobal = 'regular';
      }

      if (targetBills && !VALID_BILLS_OVERRIDES.includes(targetBills)) {
        targetBills = null;
      }

      if (targetSabres && !VALID_SABRES_OVERRIDES.includes(targetSabres)) {
        targetSabres = null;
      }

      // Resolve effective team themes (paired era defaults if override is null)
      const effectiveBills = targetBills || (
        targetGlobal === '90s-nostalgia' ? 'red-helmet' :
        targetGlobal === 'the-aud-era' ? 'standing-buffalo' :
        targetGlobal
      );

      const effectiveSabres = targetSabres || (
        targetGlobal === '90s-nostalgia' ? 'goathead' :
        targetGlobal === 'the-aud-era' ? 'french-connection' :
        targetGlobal
      );

      // Detect current page context
      const path = (typeof window !== 'undefined' && window.location) ? window.location.pathname : '';
      const isBillsHub = path.includes('bills.html') || document.body?.classList.contains('bills-theme');
      const isSabresHub = path.includes('sabres.html') || document.body?.classList.contains('sabres-theme');

      if (isBillsHub) {
        // Full page adoption for bills.html
        document.documentElement.setAttribute('data-theme', effectiveBills);
      } else if (isSabresHub) {
        // Full page adoption for sabres.html
        document.documentElement.setAttribute('data-theme', effectiveSabres);
      } else {
        // index.html: Canvas runs globalTheme, cards run team-specific themes
        document.documentElement.setAttribute('data-theme', targetGlobal);
        const billsCard = document.getElementById('bills-card') || document.querySelector('.card-bills');
        if (billsCard) {
          billsCard.setAttribute('data-team-theme', effectiveBills);
        }
        const sabresCard = document.getElementById('sabres-card') || document.querySelector('.card-sabres');
        if (sabresCard) {
          sabresCard.setAttribute('data-team-theme', effectiveSabres);
        }
      }

      const activeThemeForMeta = isBillsHub ? effectiveBills : isSabresHub ? effectiveSabres : targetGlobal;
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', THEME_COLORS[activeThemeForMeta] || '#080a0f');
      }

      return {
        globalTheme: targetGlobal,
        billsTheme: effectiveBills,
        sabresTheme: effectiveSabres
      };
    }

    if (typeof document !== 'undefined') {
      const initialTheme = document.documentElement.getAttribute('data-theme') || 'regular';
      applyTheme(initialTheme);
    }

    // WAI-ARIA Accessible Tab Switching & URL Hash Deep-Linking
    const VALID_TAB_IDS = ['intel', 'rooting', 'radar'];

    function switchTab(tabId, focusTab = false) {
      if (!VALID_TAB_IDS.includes(tabId)) return;
      const targetBtn = document.getElementById(`tab-btn-${tabId}`);
      if (!targetBtn) return;

      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
        btn.setAttribute('tabindex', '-1');
      });
      targetBtn.classList.add('active');
      targetBtn.setAttribute('aria-selected', 'true');
      targetBtn.setAttribute('tabindex', '0');
      if (focusTab) targetBtn.focus();

      const activatePanel = () => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        const targetTab = document.getElementById(`tab-${tabId}`);
        if (targetTab) targetTab.classList.add('active');
      };

      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(activatePanel);
      } else {
        activatePanel();
      }

      try {
        if (window.history && window.history.replaceState) {
          const targetHash = `#${tabId}`;
          if (window.location.hash !== targetHash) {
            window.history.replaceState(null, '', targetHash);
          }
        }
      } catch (e) {}
    }

    function initAccessibleTabs() {
      const tablist = document.querySelector('[role="tablist"]');
      if (tablist && !tablist.dataset.a11yBound) {
        tablist.dataset.a11yBound = 'true';
        tablist.addEventListener('keydown', (e) => {
          const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
          if (tabs.length === 0) return;
          const currentIndex = tabs.findIndex(t => t.classList.contains('active') || t.getAttribute('aria-selected') === 'true');
          let nextIndex = -1;

          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            nextIndex = (currentIndex + 1) % tabs.length;
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          } else if (e.key === 'Home') {
            nextIndex = 0;
          } else if (e.key === 'End') {
            nextIndex = tabs.length - 1;
          }

          if (nextIndex !== -1) {
            e.preventDefault();
            const targetBtn = tabs[nextIndex];
            const tabId = (targetBtn.id || '').replace('tab-btn-', '');
            if (tabId) switchTab(tabId, true);
          }
        });
      }

      const rawHash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
      if (VALID_TAB_IDS.includes(rawHash)) {
        switchTab(rawHash, false);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('DOMContentLoaded', initAccessibleTabs);
      window.addEventListener('hashchange', () => {
        const rawHash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
        if (VALID_TAB_IDS.includes(rawHash)) {
          switchTab(rawHash, false);
        }
      });
    }

    // Accessible Slate Filter Toggle
    let currentSlateFilter = 'all';

    function setSlateFilter(filter, gridId) {
      currentSlateFilter = filter;
      document.querySelectorAll('.slate-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      });
      const activeBtn = document.getElementById(`filter-btn-${filter}`);
      if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-pressed', 'true');
      }
      const grid = gridId
        ? document.getElementById(gridId)
        : (document.getElementById('bills-scoreboard-grid') || document.getElementById('sabres-scoreboard-grid'));
      if (grid) grid.setAttribute('data-filter', filter);
    }

    // Tale of the Tape: Parse rank or numeric metric value and highlight the statistical leader
    function compareEfficiencyRow(bufValStr, oppValStr, metricName) {
      const bStr = String(bufValStr || '');
      const oStr = String(oppValStr || '');
      const rankRegex = /\((\d+)(?:st|nd|rd|th)\)/i;
      const bRankMatch = bStr.match(rankRegex);
      const oRankMatch = oStr.match(rankRegex);

      if (bRankMatch && oRankMatch) {
        const bRank = parseInt(bRankMatch[1], 10);
        const oRank = parseInt(oRankMatch[1], 10);
        if (bRank < oRank) return 'buf';
        if (oRank < bRank) return 'opp';
        return 'tie';
      }

      const numRegex = /([+-]?\d+(?:\.\d+)?)/;
      const bNumMatch = bStr.match(numRegex);
      const oNumMatch = oStr.match(numRegex);
      if (bNumMatch && oNumMatch) {
        const bNum = parseFloat(bNumMatch[1]);
        const oNum = parseFloat(oNumMatch[1]);
        const mLower = String(metricName || '').toLowerCase();
        const lowerIsBetter = mLower.includes('against') || mLower.includes('allowed') || mLower.includes('ga/gp');
        if (lowerIsBetter) {
          if (bNum < oNum) return 'buf';
          if (oNum < bNum) return 'opp';
        } else {
          if (bNum > oNum) return 'buf';
          if (oNum > bNum) return 'opp';
        }
      }
      return 'tie';
    }

    function renderEfficiencyRows(efficiencyData, teamKey = 'bills') {
      if (!Array.isArray(efficiencyData) || efficiencyData.length === 0) return '';
      return efficiencyData.map(row => {
        const bufVal = row[teamKey] ?? row.bills ?? row.sabres ?? '--';
        const oppVal = row.opp ?? '--';
        const winner = compareEfficiencyRow(bufVal, oppVal, row.metric);

        const bufClass = winner === 'buf'
          ? 'intel-col-buf intel-edge-win'
          : (winner === 'opp' ? 'intel-col-buf intel-col-trailing' : 'intel-col-buf');
        const oppClass = winner === 'opp'
          ? 'intel-col-opp intel-edge-win'
          : (winner === 'buf' ? 'intel-col-opp intel-col-trailing' : 'intel-col-opp');

        const bufBadge = winner === 'buf' ? ' <span class="intel-edge-badge" title="Statistical Edge">EDGE</span>' : '';
        const oppBadge = winner === 'opp' ? ' <span class="intel-edge-badge" title="Statistical Edge">EDGE</span>' : '';

        return `
          <tr>
            <td class="intel-col-metric">${row.metric}</td>
            <td class="${bufClass}">${bufVal}${bufBadge}</td>
            <td class="${oppClass}">${oppVal}${oppBadge}</td>
          </tr>
        `;
      }).join('');
    }

    // Proportional Seeding Distribution Bars
    function renderSeedDistribution(seedDistribution, fillClass = 'dist-fill-bills') {
      if (!Array.isArray(seedDistribution) || seedDistribution.length === 0) return '';
      const pcts = seedDistribution.map(d => Number(d.pct) || 0);
      const maxPct = Math.max(...pcts, 0);
      const scaleDenom = Math.max(maxPct, 25);

      return seedDistribution.map(item => {
        const pct = Number(item.pct) || 0;
        const scaledWidth = pct > 0
          ? Math.max(4, Math.min(100, Math.round((pct / scaleDenom) * 100)))
          : 0;
        const isLeader = maxPct > 0 && pct === maxPct;
        return `
          <div class="dist-row${isLeader ? ' dist-row-leader' : ''}">
            <span class="dist-name">${item.seed}</span>
            <div class="dist-track">
              <div class="${fillClass}" style="width: ${scaledWidth}%"></div>
            </div>
            <span class="dist-pct">${pct}%</span>
          </div>
        `;
      }).join('');
    }
