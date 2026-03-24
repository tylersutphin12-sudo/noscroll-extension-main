// Reload the active tab so setting changes apply immediately.
// Skips chrome:// and extension pages.
function reloadActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id || !tab.url) return;
    const url = tab.url.toLowerCase();
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') || url.startsWith('about:')) return;
    chrome.tabs.reload(tab.id);
  });
}

// Unified time formatting: sec under 60, min at 60+, hours at 3600+
function formatTimeSaved(seconds) {
  const s = Math.floor(seconds || 0);
  if (s < 60) return `${s} sec`;
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

function updateToggleUI(enabled) {
  const statusText = document.getElementById('status-text');
  const statusDot  = document.getElementById('status-dot');
  const popupRoot  = document.getElementById('popup-root');
  if (enabled) {
    statusText.textContent = 'Blocking Active';
    statusDot.className = 'status-dot';
    popupRoot?.classList.remove('popup-paused');
  } else {
    statusText.textContent = 'Paused';
    statusDot.className = 'status-dot off';
    popupRoot?.classList.add('popup-paused');
  }
}

function updateTooltipPositioning() {
  const popupRoot = document.getElementById('popup-root');
  if (!popupRoot) return;
  const popupRight = popupRoot.getBoundingClientRect().right;
  const tooltipWidth = 220;
  const gap = 8;
  document.querySelectorAll('.help-icon:not(.help-icon-platform)').forEach((icon) => {
    const rect = icon.getBoundingClientRect();
    const wouldOverflow = rect.right + gap + tooltipWidth > popupRight;
    icon.classList.toggle('tooltip-left', wouldOverflow);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const logo = document.querySelector('.app-logo');
  if (logo && typeof chrome?.runtime?.getURL === 'function') {
    logo.src = chrome.runtime.getURL('assets/logo.png');
  }
  document.getElementById('privacy-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('privacy.html') });
  });
  document.getElementById('terms-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('terms.html') });
  });
  requestAnimationFrame(() => updateTooltipPositioning());
  setTimeout(updateTooltipPositioning, 150);

  const FREE_DELAY = window.NoScrollFeatures?.FREE_DELAY_SECONDS ?? 2;

  chrome.storage.local.get(
    ['enabled', 'todayTimeSaved', 'todayBlocks', 'totalTimeSaved', 'totalBlocks',
     'timeSaved', 'totalBlocked', 'customMessage', 'focusMode', 'delaySeconds',
     'platformEnabled', 'showFocusModeIndicator', 'isPro'],
    (data) => {
      const isPro = !!data.isPro;
      const isEnabled = data.enabled !== false;
      let todayTimeSaved = data.todayTimeSaved ?? 0;
      let todayBlocks = data.todayBlocks ?? 0;
      let totalTimeSaved = data.totalTimeSaved;
      let totalBlocks = data.totalBlocks;
      if (totalTimeSaved == null) totalTimeSaved = data.timeSaved?.allTime ?? 0;
      if (totalBlocks == null) totalBlocks = data.totalBlocked ?? 0;
      const focusModeEnabled = data.focusMode || false;
      let platformEnabled = data.platformEnabled || {
        youtube: true, tiktok: true, instagram: true,
        facebook: true, twitter: true, reddit: true
      };

      if (!isPro) {
        platformEnabled = { youtube: platformEnabled.youtube !== false, tiktok: false, instagram: false, facebook: false, twitter: false, reddit: false };
        chrome.storage.local.set({ platformEnabled }, () => {});
      }

      let delaySecondsValue = isPro
        ? Math.min(10, Math.max(1, data.delaySeconds ?? 1))
        : FREE_DELAY;
      if (isPro && data.delaySeconds != null && (data.delaySeconds > 10 || data.delaySeconds < 1)) {
        chrome.storage.local.set({ delaySeconds: delaySecondsValue }, () => {});
      }
      const showIndicator = data.showFocusModeIndicator !== false;

      const popupRoot = document.getElementById('popup-root');
      popupRoot?.classList.remove('popup-free', 'popup-pro');
      popupRoot?.classList.add(isPro ? 'popup-pro' : 'popup-free');

      // Header tier badge (centered)
      const tierBadge = document.getElementById('tier-label');
      if (tierBadge) tierBadge.textContent = isPro ? 'Pro Version' : 'Free Version';

      // Message helper (Free mode) - subtle
      const messageHelper = document.getElementById('message-helper');
      if (messageHelper) messageHelper.textContent = isPro ? '' : 'Free uses the default. Pro unlocks custom messages.';

      // Toggle
      const toggle = document.getElementById('main-toggle');
      toggle.checked = isEnabled;
      updateToggleUI(isEnabled);

      // Stats
      document.getElementById('stat-today').textContent   = formatTimeSaved(todayTimeSaved);
      document.getElementById('stat-blocks').textContent   = todayBlocks.toString();
      document.getElementById('stat-alltime').textContent = formatTimeSaved(totalTimeSaved);
      document.getElementById('stat-totalblocks').textContent = totalBlocks.toString();

      // Custom message: Free always shows default; Pro shows stored or default
      const defaultMsg = window.NoScrollFeatures?.DEFAULT_MESSAGE ?? 'Take a moment — is this worth your time?';
      const customMessageEl = document.getElementById('custom-message');
      customMessageEl.value = isPro ? (data.customMessage || defaultMsg) : defaultMsg;

      // Tester toggle
      const testerFree = document.getElementById('tester-free');
      const testerPro = document.getElementById('tester-pro');
      if (testerFree) {
        testerFree.classList.toggle('active', !isPro);
        testerFree.addEventListener('click', () => {
          chrome.storage.local.set({ isPro: false }, () => { location.reload(); });
        });
      }
      if (testerPro) {
        testerPro.classList.toggle('active', isPro);
        testerPro.addEventListener('click', () => {
          chrome.storage.local.set({ isPro: true }, () => { location.reload(); });
        });
      }

      // Focus Mode setup
      const focusModeToggle = document.getElementById('focus-mode-toggle');
      const focusModeToggleWrap = document.getElementById('focus-mode-toggle-wrap');
      focusModeToggle.checked = focusModeEnabled;
      focusModeToggle.disabled = false;

      function updateFocusModeOffHelp() {
        if (focusModeToggleWrap) {
          focusModeToggleWrap.classList.toggle('focus-on', focusModeToggle.checked);
        }
      }
      updateFocusModeOffHelp();
      requestAnimationFrame(() => updateTooltipPositioning());

      focusModeToggle.addEventListener('change', (e) => {
        chrome.storage.local.set({ focusMode: e.target.checked }, reloadActiveTab);
        updateFocusModeOffHelp();
        requestAnimationFrame(() => updateTooltipPositioning());
      });

      // Show Focus Mode Indicator (v11)
      const showIndicatorToggle = document.getElementById('show-indicator-toggle');
      if (showIndicatorToggle) {
        showIndicatorToggle.checked = showIndicator;
        showIndicatorToggle.addEventListener('change', (e) => {
          chrome.storage.local.set({ showFocusModeIndicator: e.target.checked }, reloadActiveTab);
        });
      }

      // Delay Timer (Free: fixed 2s, Pro: 1–10s). Free slider looks like Pro, fixed at 2s.
      const delaySlider = document.getElementById('delay-slider');
      const delayValueEl = document.getElementById('delay-value');
      const delayHelper = document.getElementById('delay-helper');
      const delayControlWrap = document.getElementById('delay-control-wrap');
      delaySlider.min = '1';
      delaySlider.max = '10';
      delaySlider.disabled = !isPro;
      delaySlider.value = String(delaySecondsValue);
      delayValueEl.textContent = `${delaySecondsValue}s`;

      if (delayHelper) {
        delayHelper.textContent = isPro ? '' : 'Free: fixed 2s. Pro unlocks 1–10s control.';
      }

      function updateDelayTrackFill(val, maxVal) {
        const m = maxVal || 10;
        const pct = ((val - 1) / (m - 1) * 100).toFixed(1) + '%';
        delayControlWrap?.style.setProperty('--delay-pct', pct);
      }
      updateDelayTrackFill(delaySecondsValue, 10);

      let lastValidDelay = delaySecondsValue;

      delaySlider?.addEventListener('input', (e) => {
        if (!isPro) return;
        const val = parseInt(e.target.value, 10);
        lastValidDelay = val;
        delayValueEl.textContent = `${val}s`;
        updateDelayTrackFill(val, 10);
      });

      delaySlider?.addEventListener('change', (e) => {
        if (!isPro) return;
        const val = parseInt(e.target.value);
        chrome.storage.local.set({ delaySeconds: val }, reloadActiveTab);
      });

      delaySlider?.addEventListener('mousedown', (e) => {
        if (!isPro) e.preventDefault();
      });

      function setDelayValue(val) {
        const maxVal = 10;
        const minVal = 1;
        const clamped = Math.min(maxVal, Math.max(minVal, parseInt(val, 10) || lastValidDelay));
        lastValidDelay = clamped;
        delaySlider.value = clamped;
        delayValueEl.textContent = `${clamped}s`;
        updateDelayTrackFill(clamped, maxVal);
        if (isPro) chrome.storage.local.set({ delaySeconds: clamped }, reloadActiveTab);
      }

      delayValueEl?.addEventListener('click', (e) => {
        if (!isPro || e.target.tagName === 'INPUT') return;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'delay-value-input';
        input.value = lastValidDelay.toString();
        input.setAttribute('data-testid', 'delay-value-input');
        delayValueEl.replaceWith(input);
        input.focus();
        input.select();

        const commit = () => {
          const val = parseInt(input.value, 10);
          setDelayValue(isNaN(val) ? lastValidDelay : val);
          input.replaceWith(delayValueEl);
        };

        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            input.blur();
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            setDelayValue(lastValidDelay);
            input.replaceWith(delayValueEl);
          }
        });
      });

      // Platform Toggles (Free: YouTube only)
      const platforms = ['youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'reddit'];

      platforms.forEach(platform => {
        const toggleEl = document.getElementById(`platform-${platform}`);
        if (!toggleEl) return;

        toggleEl.checked = platformEnabled[platform] !== false;
        toggleEl.disabled = !isPro && platform !== 'youtube';

        toggleEl.addEventListener('change', (e) => {
          if (!isPro && platform !== 'youtube') return;
          platformEnabled = { ...platformEnabled, [platform]: e.target.checked };
          if (!isPro) {
            platformEnabled = { youtube: platformEnabled.youtube, tiktok: false, instagram: false, facebook: false, twitter: false, reddit: false };
          }
          chrome.storage.local.set({ platformEnabled }, reloadActiveTab);
        });
      });

      // Event Handlers
      toggle.addEventListener('change', (e) => {
        chrome.storage.local.set({ enabled: e.target.checked }, reloadActiveTab);
        updateToggleUI(e.target.checked);
      });

      document.getElementById('save-message').addEventListener('click', () => {
        if (!isPro) return;
        const msg = document.getElementById('custom-message').value;
        chrome.storage.local.set({ customMessage: msg }, reloadActiveTab);
        const btn = document.getElementById('save-message');
        btn.textContent = 'Saved ✓';
        btn.classList.add('saved');
        setTimeout(() => {
          btn.textContent = 'Save';
          btn.classList.remove('saved');
        }, 1500);
      });

      // Listen for stat updates (e.g. from blocking in another tab)
      function animateStats() {
        ['stat-today', 'stat-blocks', 'stat-alltime'].forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            el.classList.remove('stat-updated');
            el.offsetHeight;
            el.classList.add('stat-updated');
            setTimeout(() => el.classList.remove('stat-updated'), 400);
          }
        });
      }
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.todayTimeSaved || changes.todayBlocks || changes.totalTimeSaved || changes.totalBlocks) {
          chrome.storage.local.get(['todayTimeSaved', 'todayBlocks', 'totalTimeSaved', 'totalBlocks'], (d) => {
            document.getElementById('stat-today').textContent = formatTimeSaved(d.todayTimeSaved ?? 0);
            document.getElementById('stat-blocks').textContent = (d.todayBlocks ?? 0).toString();
            document.getElementById('stat-alltime').textContent = formatTimeSaved(d.totalTimeSaved ?? 0);
            document.getElementById('stat-totalblocks').textContent = (d.totalBlocks ?? 0).toString();
            animateStats();
          });
        }
        if (changes.isPro) location.reload();
      });
    }
  );
});
