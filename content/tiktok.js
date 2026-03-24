// NoScroll - TikTok
// Intentional friction for videos + Focus Mode
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

  const revealedIds = new Set(); // Video IDs user has revealed (identity-based, survives DOM reuse)
  let currentVideo  = null;
  let currentVideoId = null;

  chrome.storage.local.get(['enabled', 'customMessage', 'focusMode', 'delaySeconds', 'platformEnabled', 'showFocusModeIndicator', 'isPro'], (data) => {
    isEnabled     = data.enabled !== false;
    focusMode     = !!data.focusMode;
    isPro         = !!data.isPro;
    delaySeconds  = Math.min(10, Math.max(1, data.delaySeconds ?? 2));
    customMessage = (data.customMessage || '').trim() || "Take a moment — is this worth your time?";
    platformEnabled = data.platformEnabled?.tiktok !== false;
    showFocusIndicator = data.showFocusModeIndicator !== false;
    /* Free mode: TikTok does nothing. Only Pro + platform enabled runs. */
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
      const m = document.getElementById('ns-message');
      if (m) m.textContent = customMessage;
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
      platformEnabled = changes.platformEnabled.newValue?.tiktok !== false;
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
    ownUsername = null;
    const extractUsername = (href) => {
      if (!href) return null;
      const m = href.match(/@([^\/\?]+)/);
      return m ? m[1] : null;
    };
    const path = window.location.pathname;

    // 1. When on /@username, "Edit profile" button = own profile (most reliable on profile page)
    const pathMatch = path.match(/^\/@([^\/]+)/);
    if (pathMatch) {
      const pageUser = pathMatch[1];
      const hasEditProfile = document.body?.innerText?.toLowerCase?.().includes('edit profile') ||
        Array.from(document.querySelectorAll('span, a, button, div')).some(el =>
          (el.textContent || '').trim().toLowerCase() === 'edit profile');
      if (hasEditProfile) {
        ownUsername = pageUser;
        return;
      }
    }

    // 2. Nav profile link (most reliable when not on profile yet)
    const navProfile = document.querySelector('[data-e2e="nav-profile"] a');
    if (navProfile?.href) {
      ownUsername = extractUsername(navProfile.href);
      if (ownUsername) return;
    }
    // 3. Profile link with data-e2e in sidebar/header
    const profileWithE2e = document.querySelector('a[href^="/@"][data-e2e]');
    if (profileWithE2e?.href) {
      ownUsername = extractUsername(profileWithE2e.href);
      if (ownUsername) return;
    }
    // 4. First profile link in nav (fallback)
    const navLink = document.querySelector('nav a[href^="/@"]');
    if (navLink?.href) {
      ownUsername = extractUsername(navLink.href);
      if (ownUsername) return;
    }
    // 5. When on /@username, check if nav profile matches current path
    if (path.startsWith('/@')) {
      const pageUser = path.split('/')[1]?.replace('@', '');
      const profileLink = navProfile || profileWithE2e || navLink;
      if (profileLink && pageUser && extractUsername(profileLink.href) === pageUser) {
        ownUsername = pageUser;
      }
    }
  }

  // ── Check if viewing own content ────────────────────────────────────────────
  function isOwnContent() {
    const path = window.location.pathname.toLowerCase();

    // 1. On own profile page (posts, videos, etc.) - check FIRST
    if (ownUsername && path.startsWith('/@' + ownUsername.toLowerCase())) {
      return true;
    }
    
    // Upload/creator/analytics: always allowed (no username needed)
    if (path.includes('/upload') || path.includes('/creator') || path.includes('/analytics')) {
      return true;
    }
    
    // Current video from own account (only when ownUsername is known)
    if (ownUsername) {
      const videoAuthor = document.querySelector('[data-e2e="video-author-uniqueid"], [data-e2e="browse-username"]');
      if (videoAuthor) {
        const authorName = (videoAuthor.textContent?.trim() || '').replace('@', '');
        if (authorName === ownUsername) return true;
      }
    }
    
    return false;
  }

  // ── Redirect destination (Creator Center: universal safe destination) ───────
  const CREATOR_CENTER_URL = 'https://www.tiktok.com/creator-center';

  function getRedirectUrl() {
    return CREATOR_CENTER_URL;
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
    if (focusMode && !ownUsername && window.location.pathname.match(/^\/@[^\/]+/)) {
      setTimeout(() => { detectOwnUsername(); onNav(); }, 800);
    }

    // 1. Own profile allowed (safe zone)  2. Messages allowed  3. Everything else
    const allowed = isAllowedPage() || isOwnContent();
    document.body?.classList.toggle('ns-allowed-page', focusMode && allowed);

    if (focusMode && !allowed) {
      NS_SHARED.showFocusModeOverlay(getRedirectUrl(), 'Return to TikTok Studio', {
        title: 'Creator Mode On',
        message: 'Feeds are hidden so you can stay focused.'
      });
      return;
    }

    if (allowed) {
      NS_SHARED.removeFocusModeOverlay();
    }
  }

  // ── Check if on feed page ───────────────────────────────────────────────────
  function isFeedPage() {
    const path = window.location.pathname;
    return path === '/' || path === '/foryou' || path === '/following' || path.startsWith('/tag/') || path.startsWith('/search');
  }

  // ── Get unique video identity (survives DOM reuse) ──────────────────────────
  const fallbackIdByElement = new WeakMap();

  function getVideoId(video, container) {
    const m = window.location.pathname.match(/\/video\/(\d+)/);
    if (m) return 'vid-' + m[1];
    const c = container || video.closest('[data-e2e="recommend-list-item-container"], [class*="DivItemContainerV2"], [class*="DivVideoCardContainer"], [class*="DivBasicPlayerWrapper"]') || video.closest('div[class*="video"]');
    const scope = c || document;
    const link = scope.querySelector?.('a[href*="/video/"]');
    if (link?.href) {
      const vm = link.href.match(/\/video\/(\d+)/);
      if (vm) return 'vid-' + vm[1];
    }
    const src = video.src || video.currentSrc || '';
    if (src) {
      const sm = src.match(/([a-f0-9]{20,})/i) || src.match(/[?&]id=([^&]+)/);
      if (sm) return 'src-' + sm[1];
      if (src.length > 30) return 'src-' + src.slice(-60).replace(/[^a-zA-Z0-9]/g, '');
    }
    if (!fallbackIdByElement.has(video)) {
      fallbackIdByElement.set(video, 'el-' + Math.random().toString(36).slice(2, 12));
    }
    return fallbackIdByElement.get(video);
  }

  // ── Find the currently visible video (most in viewport) ──────────────────────
  function getCurrentVisibleVideo() {
    const videos = document.querySelectorAll('video');
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    let best = null;
    let bestArea = 0;
    for (const v of videos) {
      if (v.offsetParent === null) continue;
      const r = v.getBoundingClientRect();
      const visibleH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const visibleW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const area = visibleH * visibleW;
      if (area > bestArea && area > vh * vw * 0.2) {
        bestArea = area;
        best = v;
      }
    }
    return best;
  }

  // ── Main blocking logic (continuous detection, identity-based) ──────────────
  function start() {
    checkAndBlock();
    const mo = new MutationObserver(() => {
      if (!isEnabled) return;
      checkAndBlock();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => { if (isEnabled) checkAndBlock(); }, 150);
    }, { passive: true });
    setInterval(() => { if (isEnabled) checkAndBlock(); }, 800);
  }

  function checkAndBlock() {
    if (!isPro || !platformEnabled || !isEnabled) return;
    if (isOwnContent()) return;
    if (window.location.pathname.includes('/messages')) return;
    if (overlayActive || document.getElementById('ns-overlay')) return;

    const video = getCurrentVisibleVideo();
    if (!video) return;

    const container = video.closest('[data-e2e="recommend-list-item-container"]') ||
      video.closest('[class*="DivItemContainerV2"]') ||
      video.closest('[class*="DivVideoCardContainer"]') ||
      video.closest('[class*="DivBasicPlayerWrapper"]') ||
      video.closest('div[class*="video"]') ||
      video.parentElement;

    const videoId = getVideoId(video, container);
    if (revealedIds.has(videoId)) return;

    if (ownUsername) {
      const authorEl = container?.querySelector?.('[data-e2e="video-author-uniqueid"], a[href^="/@"]');
      if (authorEl) {
        const authorName = (authorEl.textContent?.trim() || '').replace('@', '') ||
          authorEl.getAttribute('href')?.split('/@')[1]?.split('/')[0] || '';
        if (authorName === ownUsername) {
          revealedIds.add(videoId);
          return;
        }
      }
    }

    showBlockedOverlay(video, container, videoId);
  }

  function getVideoDuration(v) {
    if (!v) return null;
    const d = v.duration;
    if (typeof d === 'number' && isFinite(d) && d > 0) return Math.round(d);
    return null;
  }

  function showBlockedOverlay(video, container, videoId) {
    if (!isPro || !platformEnabled) return;
    if (overlayActive || document.getElementById('ns-overlay')) return;
    overlayActive = true;
    currentVideo = video;
    currentVideoId = videoId;
    
    video.pause();
    chrome.runtime.sendMessage({ type: 'BLOCK_EVENT', platform: 'tiktok' });
    
    let dur = getVideoDuration(video);
    const fallback = 30;
    const getDisplayDuration = () => (dur != null && dur > 0) ? dur : fallback;
    let previewText = NS_SHARED.formatReturnToTikTokPreview(getDisplayDuration());
    if (dur == null && video) {
      video.addEventListener('loadedmetadata', () => {
        dur = getVideoDuration(video);
        if (dur != null) {
          const el = document.querySelector('#ns-overlay .ns-saved');
          if (el) el.textContent = NS_SHARED.formatReturnToTikTokPreview(dur);
        }
      }, { once: true });
      if (video.readyState >= 1) { dur = getVideoDuration(video); if (dur != null) previewText = NS_SHARED.formatReturnToTikTokPreview(dur); }
    }
    
    NS_SHARED.injectStyle('ns-styles', NS_SHARED.getOverlayCSS());
    
    const overlay = document.createElement('div');
    overlay.id = 'ns-overlay';
    overlay.innerHTML = `<div class="ns-container"><div class="ns-logo">NoScroll</div><div class="ns-circles"><div class="ns-circle ns-c1"></div><div class="ns-circle ns-c2"></div><div class="ns-circle ns-c3"></div></div><p class="ns-message" id="ns-message"></p><div class="ns-saved">${previewText}</div><div class="ns-btns" id="ns-btns"><button class="ns-btn-primary" id="ns-back">Return to TikTok Studio</button><button class="ns-btn-ghost" id="ns-continue">Unblock This Video</button><button class="ns-btn-dark" id="ns-close">Close This Tab</button></div></div>`;
    document.body.appendChild(overlay);
    const effectiveMessage = window.NoScrollFeatures ? NoScrollFeatures.getEffectiveMessage(customMessage, isPro) : customMessage;
    const effectiveDelay = window.NoScrollFeatures ? NoScrollFeatures.getEffectiveDelaySeconds(delaySeconds, isPro) : delaySeconds;
    overlay.querySelector('#ns-message').textContent = effectiveMessage;
    setTimeout(() => overlay.querySelector('.ns-btns')?.classList.add('ns-visible'), 1000);

    const sendTimeSavedOnSkip = () => {
      chrome.runtime.sendMessage({ type: 'SAVE_TIME', platform: 'tiktok', seconds: (dur != null ? dur : fallback) });
    };

    overlay.querySelector('#ns-back')?.addEventListener('click', (e) => {
      e.stopPropagation();
      sendTimeSavedOnSkip();
      window.location.href = getRedirectUrl();
    });
    
    overlay.querySelector('#ns-continue')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = overlay.querySelector('#ns-continue');
      if (!btn) return;
      NS_SHARED.createRevealCountdown(btn, effectiveDelay, () => {
        if (currentVideoId) revealedIds.add(currentVideoId);
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
    currentVideo = null;
    currentVideoId = null;
    document.getElementById('ns-overlay')?.remove();
    document.getElementById('ns-styles')?.remove();
  }

  // ── Focus Mode ──────────────────────────────────────────────────────────────
  function isAllowedPage() {
    const path = window.location.pathname.toLowerCase();
    const href = window.location.href.toLowerCase();

    // 1. Own profile (safe zone) - check FIRST
    if (ownUsername && path.startsWith('/@' + ownUsername.toLowerCase())) {
      return true;
    }

    // 2. Messages - always allowed
    if (path.includes('/messages')) {
      return true;
    }

    // 3. Creator Center, studio, upload, creator, analytics, settings
    if (path.includes('creator-center') || path.includes('creatorcenter') ||
        path.includes('tiktokstudio') || path.includes('creator-tools') ||
        href.includes('creator-center')) {
      return true;
    }
    if (path.includes('/upload') || path.includes('/creator') || path.includes('/analytics') ||
        path.includes('/settings')) {
      return true;
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
        NS_SHARED.showFocusModeOverlay(getRedirectUrl(), 'Return to TikTok Studio', {
          title: 'Creator Mode On',
          message: 'Feeds are hidden so you can stay focused.'
        });
      }
      const css = document.createElement('style');
      css.id = 'ns-focus-css';
      css.textContent = `
        /* Hide discovery feeds only when NOT on own profile/messages */
        body:not(.ns-allowed-page) [data-e2e="recommend-list-item-container"],
        body:not(.ns-allowed-page) [class*="DivVideoFeedV2"],
        body:not(.ns-allowed-page) [class*="DivItemContainerForSearch"],
        body:not(.ns-allowed-page) [class*="DivThreeColumnContainer"] > div:first-child {
          display: none !important;
        }
      `;
      document.head.appendChild(css);
    }
    document.body?.classList.toggle('ns-allowed-page', isAllowedPage() || isOwnContent());
    if (showFocusIndicator) NS_SHARED.addFocusIndicator();
  }

  function disableFocusMode() {
    document.getElementById('ns-focus-css')?.remove();
    document.body?.classList.remove('ns-allowed-page');
    NS_SHARED.removeFocusIndicator();
    NS_SHARED.removeFocusModeOverlay();
  }
})();
