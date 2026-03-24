// NoScroll - Instagram
// Intentional friction for Reels + Focus Mode
(function () {
  let isEnabled     = true;
  let focusMode     = false;
  let delaySeconds  = 1;
  let customMessage = "Take a moment — is this worth your time?";
  let overlayActive = false;
  let lastUrl       = window.location.href;
  let ownUsername   = null;
  let platformEnabled = true;
  let showFocusIndicator = true;
  let isPro = false;

  const revealedIds  = new Set();
  const fallbackIdByElement = new WeakMap();

  chrome.storage.local.get(['enabled', 'customMessage', 'focusMode', 'delaySeconds', 'platformEnabled', 'showFocusModeIndicator', 'isPro'], (data) => {
    isEnabled     = data.enabled !== false;
    focusMode     = !!data.focusMode;
    isPro         = !!data.isPro;
    delaySeconds  = Math.min(10, Math.max(1, data.delaySeconds ?? 2));
    customMessage = (data.customMessage || '').trim() || "Take a moment — is this worth your time?";
    platformEnabled = data.platformEnabled?.instagram !== false;
    showFocusIndicator = data.showFocusModeIndicator !== false;
    /* Free mode: Instagram does nothing. Only Pro + platform enabled runs. */
    if (!isPro || !platformEnabled) return;
    detectOwnUsername();
    if (isEnabled) start();
    if (isEnabled && focusMode) enableFocusMode();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
      isEnabled = changes.enabled.newValue !== false;
      if (!isEnabled || !platformEnabled || !isPro) { removeOverlay(); disableFocusMode(); }
      else { start(); if (focusMode) enableFocusMode(); }
    }
    if (changes.customMessage) {
      customMessage = (changes.customMessage.newValue || '').trim() || "Take a moment — is this worth your time?";
    }
    if (changes.focusMode) {
      focusMode = !!changes.focusMode.newValue;
      if (focusMode && isEnabled && platformEnabled && isPro) enableFocusMode();
      else disableFocusMode();
    }
    if (changes.showFocusModeIndicator) {
      showFocusIndicator = changes.showFocusModeIndicator.newValue !== false;
      if (focusMode && isEnabled && platformEnabled && isPro) updateFocusIndicator();
    }
    if (changes.delaySeconds) {
      delaySeconds = Math.min(10, Math.max(1, changes.delaySeconds.newValue ?? 1));
    }
    if (changes.platformEnabled) {
      platformEnabled = changes.platformEnabled.newValue?.instagram !== false;
      if (!platformEnabled) { removeOverlay(); disableFocusMode(); }
      else if (isEnabled && isPro) { start(); if (focusMode) enableFocusMode(); }
    }
    if (changes.isPro) {
      isPro = !!changes.isPro.newValue;
      if (!isPro) { removeOverlay(); disableFocusMode(); }
      else if (isEnabled && platformEnabled) { start(); if (focusMode) enableFocusMode(); }
    }
  });

  // ── Detect own username ──────────────────────────────────────────────────────
  function detectOwnUsername() {
    const path = window.location.pathname;
    const pathMatch = path.match(/^\/([a-zA-Z0-9._]+)\/?$/);

    // Method 1: When on own profile page, "Edit profile" link/button is visible
    if (pathMatch && !['explore', 'reels', 'direct', 'accounts', 'stories', 'p'].includes(pathMatch[1])) {
      const hasEditProfile = document.body?.innerText?.toLowerCase?.().includes('edit profile') ||
        Array.from(document.querySelectorAll('span, a, button')).some(el =>
          (el.textContent || '').trim().toLowerCase() === 'edit profile');
      if (hasEditProfile) {
        ownUsername = pathMatch[1];
        return;
      }
    }

    // Method 2: Find profile link in navigation (nav item with profile pic)
    const profileLinks = document.querySelectorAll('a[href^="/"][role="link"]');
    for (const link of profileLinks) {
      const href = link.getAttribute('href');
      if (href && href.match(/^\/[a-zA-Z0-9._]+\/?$/) &&
          !['/', '/explore/', '/reels/', '/direct/', '/accounts/', '/stories/'].some(p => href.startsWith(p))) {
        if (link.querySelector('img[alt*="profile"]') || link.querySelector('span[class*="avatar"]') ||
            link.closest('[role="navigation"]')) {
          ownUsername = href.replace(/^\/|\/$/g, '');
          return;
        }
      }
    }

    // Method 3: Last nav link that looks like a profile (Instagram often puts profile last)
    const navLinks = document.querySelectorAll('[role="navigation"] a[href^="/"]');
    for (const link of Array.from(navLinks).reverse()) {
      const href = link.getAttribute('href');
      if (href && href.match(/^\/[a-zA-Z0-9._]+\/?$/) &&
          !['/', '/explore/', '/reels/', '/direct/', '/accounts/', '/stories/'].some(p => href.startsWith(p))) {
        ownUsername = href.replace(/^\/|\/$/g, '');
        return;
      }
    }
  }

  // ── Check if viewing own content ────────────────────────────────────────────
  function isOwnContent() {
    const path = window.location.pathname;
    
    // On own profile page
    if (ownUsername && (path === '/' + ownUsername || path === '/' + ownUsername + '/')) {
      return true;
    }
    
    // On account settings/edit pages
    if (path.includes('/accounts/')) {
      return true;
    }
    
    // Check if current reel/post is from own account
    // This checks the author name on the current view
    const authorEl = document.querySelector('header a[href^="/"]:not([href="/explore/"]):not([href="/reels/"])');
    if (authorEl && ownUsername) {
      const href = authorEl.getAttribute('href')?.replace(/^\/|\/$/g, '');
      if (href === ownUsername) return true;
    }
    
    return false;
  }

  // ── Get profile URL (FIXED: no more loops) ──────────────────────────────────
  function getProfileUrl() {
    // Always return the direct profile URL, not the current page
    if (ownUsername) {
      return `https://www.instagram.com/${ownUsername}/`;
    }
    // Fallback to accounts page which always works
    return 'https://www.instagram.com/accounts/edit/';
  }

  // ── Navigation handling ─────────────────────────────────────────────────────
  const origPush = history.pushState.bind(history);
  history.pushState = (...a) => { origPush(...a); onNav(); };
  window.addEventListener('popstate', onNav);
  setInterval(() => { if (window.location.href !== lastUrl) { lastUrl = window.location.href; onNav(); } }, 500);

  function onNav() {
    if (!isPro || !platformEnabled) return;
    lastUrl = window.location.href;
    detectOwnUsername();
    if (!isEnabled) return;

    // Deferred re-check: own profile may load "Edit profile" after DOM ready
    const pathMatch = window.location.pathname.match(/^\/([a-zA-Z0-9._]+)\/?$/);
    if (focusMode && !ownUsername && pathMatch && !['explore', 'reels', 'direct', 'accounts', 'stories', 'p'].includes(pathMatch[1])) {
      setTimeout(() => { detectOwnUsername(); onNav(); }, 800);
    }

    // In Focus Mode, show overlay on feed/explore/others' profiles
    if (focusMode && !isAllowedPage() && !isOwnContent()) {
      NS_SHARED.showFocusModeOverlay(getProfileUrl(), 'Return to Instagram');
      return;
    }

    // Remove focus overlay if navigating to allowed page
    if (isAllowedPage() || isOwnContent()) {
      NS_SHARED.removeFocusModeOverlay();
    }
  }

  // ── Check if on reels page ──────────────────────────────────────────────────
  function isReelsPage() {
    return window.location.pathname.startsWith('/reels/') || window.location.pathname === '/reels';
  }

  // ── Get stable reel ID (survives DOM recycling) ──────────────────────────────
  function getReelId(video) {
    const src = video.src || video.currentSrc || '';
    if (src) {
      const hash = src.match(/([a-f0-9]{16,})/i);
      if (hash) return 'reel-' + hash[1].slice(0, 24);
      const idMatch = src.match(/[?&]id=([^&]+)/);
      if (idMatch) return 'reel-' + idMatch[1];
      if (src.length > 50) return 'reel-' + src.slice(-60).replace(/[^A-Za-z0-9]/g, '').slice(-24);
    }
    const container = video.closest('article') || video.closest('div[class*="reel"]') || video.parentElement;
    const link = container?.querySelector?.('a[href*="/reels/"]');
    if (link?.href) {
      const rm = link.href.match(/\/reels\/([^\/\?]+)/);
      if (rm) return 'reel-' + rm[1];
    }
    if (!fallbackIdByElement.has(video)) {
      fallbackIdByElement.set(video, 'reel-el-' + Math.random().toString(36).slice(2, 12));
    }
    return fallbackIdByElement.get(video);
  }

  // ── Main blocking logic ─────────────────────────────────────────────────────
  function start() {
    processVideos();
    
    const mo = new MutationObserver(() => {
      if (!isEnabled) return;
      processVideos();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    
    // Periodic check
    setInterval(() => {
      if (isEnabled) processVideos();
    }, 1000);
  }

  function processVideos() {
    if (!isPro || !platformEnabled || !isEnabled) return;
    if (isOwnContent()) return;
    if (window.location.pathname.startsWith('/direct')) return;

    document.querySelectorAll('video').forEach(video => {
      const reelId = getReelId(video);
      if (revealedIds.has(reelId)) return;
      handleVideo(video);
    });
  }

  function handleVideo(video) {
    if (!isPro || !platformEnabled) return;
    const reelId = getReelId(video);
    if (revealedIds.has(reelId) || overlayActive) return;
    if (window.location.pathname.startsWith('/direct')) return;
    
    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        const id = getReelId(video);
        if (!entry.isIntersecting || !isEnabled || revealedIds.has(id)) return;
        if (overlayActive || document.getElementById('ns-overlay')) return;
        observer.unobserve(entry.target);
        
        if (isOwnContent()) {
          revealedIds.add(id);
          return;
        }
        
        showBlockedOverlay(video);
      });
    }, { threshold: 0.5 });
    io.observe(video);
  }

  function getVideoDuration(v) {
    if (!v) return null;
    const d = v.duration;
    if (typeof d === 'number' && isFinite(d) && d > 0) return Math.round(d);
    return null;
  }

  function showBlockedOverlay(video) {
    if (!isPro || !platformEnabled) return;
    if (overlayActive || document.getElementById('ns-overlay')) return;
    overlayActive = true;
    
    video.pause();
    chrome.runtime.sendMessage({ type: 'BLOCK_EVENT', platform: 'instagram' });
    
    let dur = getVideoDuration(video);
    const fallback = 30;
    const getDisplayDuration = () => (dur != null && dur > 0) ? dur : fallback;
    let previewText = NS_SHARED.formatReturnToInstagramPreview(getDisplayDuration());
    if (dur == null && video) {
      video.addEventListener('loadedmetadata', () => {
        dur = getVideoDuration(video);
        if (dur != null) {
          const el = document.querySelector('#ns-overlay .ns-saved');
          if (el) el.textContent = NS_SHARED.formatReturnToInstagramPreview(dur);
        }
      }, { once: true });
      if (video.readyState >= 1) { dur = getVideoDuration(video); if (dur != null) previewText = NS_SHARED.formatReturnToInstagramPreview(dur); }
    }

    NS_SHARED.injectStyle('ns-styles', NS_SHARED.getOverlayCSS());

    const overlay = document.createElement('div');
    overlay.id = 'ns-overlay';
    overlay.innerHTML = `<div class="ns-container"><div class="ns-logo">NoScroll</div><div class="ns-circles"><div class="ns-circle ns-c1"></div><div class="ns-circle ns-c2"></div><div class="ns-circle ns-c3"></div></div><p class="ns-message" id="ns-message"></p><div class="ns-saved">${previewText}</div><div class="ns-btns" id="ns-btns"><button class="ns-btn-primary" id="ns-back">Return to Profile</button><button class="ns-btn-ghost" id="ns-continue">Unblock This Video</button><button class="ns-btn-dark" id="ns-close">Close This Tab</button></div></div>`;
    document.body.appendChild(overlay);
    const effectiveMessage = window.NoScrollFeatures ? NoScrollFeatures.getEffectiveMessage(customMessage, isPro) : customMessage;
    const effectiveDelay = window.NoScrollFeatures ? NoScrollFeatures.getEffectiveDelaySeconds(delaySeconds, isPro) : delaySeconds;
    overlay.querySelector('#ns-message').textContent = effectiveMessage;
    setTimeout(() => overlay.querySelector('.ns-btns')?.classList.add('ns-visible'), 1000);

    const sendTimeSavedOnSkip = () => {
      chrome.runtime.sendMessage({ type: 'SAVE_TIME', platform: 'instagram', seconds: (dur != null ? dur : fallback) });
    };

    overlay.querySelector('#ns-back')?.addEventListener('click', (e) => {
      e.stopPropagation();
      sendTimeSavedOnSkip();
      window.location.href = getProfileUrl();
    });
    
    overlay.querySelector('#ns-continue')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = overlay.querySelector('#ns-continue');
      if (!btn) return;
      const reelId = getReelId(video);
      NS_SHARED.createRevealCountdown(btn, effectiveDelay, () => {
        revealedIds.add(reelId);
        removeOverlay();
        video.play();
      });
    });
    
    overlay.querySelector('#ns-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      sendTimeSavedOnSkip();
      chrome.runtime.sendMessage({ type: 'CLOSE_TAB' });
    });
  }

  function removeOverlay() {
    overlayActive = false;
    document.getElementById('ns-overlay')?.remove();
    document.getElementById('ns-styles')?.remove();
  }

  // ── Focus Mode ──────────────────────────────────────────────────────────────
  function isAllowedPage() {
    const path = window.location.pathname;
    
    // Allow own profile
    if (ownUsername && (path === '/' + ownUsername || path.startsWith('/' + ownUsername + '/'))) {
      return true;
    }
    
    // Allow: accounts/settings, direct messages, create
    if (path.includes('/accounts/') || 
        path.startsWith('/direct/') ||
        path.includes('/create/') ||
        path.includes('/settings/')) {
      return true;
    }
    
    // Allow viewing individual posts on own profile
    if (path.match(/^\/p\/[^\/]+\/?$/)) {
      // Check if it's own post (would need to check author)
      return true; // Allow all individual posts for now
    }
    
    return false;
  }

  function updateFocusIndicator() {
    NS_SHARED.removeFocusIndicator();
    if (showFocusIndicator) NS_SHARED.addFocusIndicator();
  }

  function enableFocusMode() {
    if (!document.getElementById('ns-focus-css')) {
      if (!isAllowedPage() && !isOwnContent()) {
        NS_SHARED.showFocusModeOverlay(getProfileUrl(), 'Return to Instagram');
      }
      const css = document.createElement('style');
      css.id = 'ns-focus-css';
      css.textContent = `
        main[role="main"] > section > div:has(article),
        main[role="main"] div:has(> a[href*="/explore/"]),
        main[role="main"] div[style*="transform"]:has(video) {
          display: none !important;
        }
      `;
      document.head.appendChild(css);
    }
    if (showFocusIndicator) NS_SHARED.addFocusIndicator();
  }

  function disableFocusMode() {
    document.getElementById('ns-focus-css')?.remove();
    NS_SHARED.removeFocusIndicator();
    NS_SHARED.removeFocusModeOverlay();
  }
})();
