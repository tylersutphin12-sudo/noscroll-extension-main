// NoScroll - Facebook
// Intentional friction for Reels/videos + Focus Mode
(function () {
  let isEnabled     = true;
  let focusMode     = false;
  let delaySeconds  = 1;
  let customMessage = "Take a moment — is this worth your time?";
  let overlayActive = false;
  let lastUrl       = window.location.href;
  let ownUserId     = null;
  let ownUsername   = null;
  let platformEnabled = true;
  let showFocusIndicator = true;
  let isPro = false;

  const revealed    = new WeakSet();
  const blocked     = new WeakSet();
  const processed   = new WeakSet();
  let currentlyPlayingVideo = null;

  chrome.storage.local.get(['enabled', 'customMessage', 'focusMode', 'delaySeconds', 'platformEnabled', 'showFocusModeIndicator', 'isPro'], (data) => {
    isEnabled     = data.enabled !== false;
    focusMode     = !!data.focusMode;
    isPro         = !!data.isPro;
    delaySeconds  = Math.min(10, Math.max(1, data.delaySeconds ?? 1));
    customMessage = (data.customMessage || '').trim() || "Take a moment. Is this worth your time?";
    platformEnabled = data.platformEnabled?.facebook !== false;
    showFocusIndicator = data.showFocusModeIndicator !== false;
    /* Free mode: Facebook does nothing. Only Pro + platform enabled runs. */
    if (!isPro || !platformEnabled) return;
    detectOwnProfile();
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
      platformEnabled = changes.platformEnabled.newValue?.facebook !== false;
      if (!platformEnabled) { removeOverlay(); disableFocusMode(); }
      else if (isEnabled && isPro) { start(); if (focusMode) enableFocusMode(); }
    }
    if (changes.isPro) {
      isPro = !!changes.isPro.newValue;
      if (!isPro) { removeOverlay(); disableFocusMode(); }
      else if (isEnabled && platformEnabled) { start(); if (focusMode) enableFocusMode(); }
    }
  });

  // ── Detect own profile ──────────────────────────────────────────────────────
  function detectOwnProfile() {
    // Find profile link from navigation
    const profileLink = document.querySelector('a[href*="/me"], a[href*="facebook.com/me"], a[href*="m.facebook.com/me"]');
    if (profileLink) {
      ownUserId = 'me';
    }

    // Try to find actual username/ID from profile menu (www or m)
    const accountLink = document.querySelector(
      '[role="navigation"] a[href*="facebook.com/"]:not([href*="/notifications"]):not([href*="/messages"]):not([href*="/watch"]):not([href*="/groups"])'
    );
    if (accountLink) {
      const linkHref = accountLink.getAttribute('href');
      const match = linkHref?.match(/facebook\.com\/([^\/\?]+)/);
      if (match && !['watch', 'reels', 'gaming', 'marketplace', 'groups', 'notifications', 'messages', 'login'].includes(match[1])) {
        ownUsername = match[1];
      }
    }
  }

  // ── Check if on messages surface (never block) ───────────────────────────────
  function isOnMessagesPage() {
    const path = window.location.pathname;
    const href = (window.location.href || '').toLowerCase();
    return path.startsWith('/messages') || path.startsWith('/messenger') ||
           href.includes('/messages') || href.includes('/messenger');
  }

  // ── Check if viewing own content (FULL SAFE ZONE on own profile) ─────────────
  function isOwnContent() {
    const path = window.location.pathname;

    // On own profile page and all sub-paths (posts, photos, videos, etc.)
    if (path === '/me' || path.startsWith('/me/')) return true;
    if (ownUsername && (path === '/' + ownUsername || path.startsWith('/' + ownUsername + '/'))) return true;

    // Pages/business manager, creator tools
    if (path.startsWith('/pages/') || path.startsWith('/business/')) return true;

    return false;
  }

  // ── Check if element is an ad ───────────────────────────────────────────────
  function isAdElement(container) {
    try {
      if (!container || !container.querySelector) return false;

      // Valid selectors only (querySelector does not support :contains)
      if (container.querySelector('a[href*="ads"]')) return true;
      if (container.querySelector('[aria-label*="Sponsored"]')) return true;

      // Check for "Sponsored" text in spans manually
      const spans = container.querySelectorAll('span');
      for (let i = 0; i < spans.length; i++) {
        if ((spans[i].textContent || '').includes('Sponsored')) return true;
      }

      // Check for ad-specific data attributes
      if (container.querySelector('[data-ad-preview], [data-testid*="ad"]')) return true;

      // Fallback: "Sponsored" in container text + article role
      const textContent = container.textContent || '';
      if (textContent.includes('Sponsored') && container.querySelector('[role="article"]')) {
        return true;
      }

      return false;
    } catch (_) {
      return false;
    }
  }

  // ── Get profile URL ─────────────────────────────────────────────────────────
  function getProfileUrl() {
    if (ownUsername) return `https://www.facebook.com/${ownUsername}`;
    return 'https://www.facebook.com/me';
  }

  // ── Navigation handling ─────────────────────────────────────────────────────
  const origPush = history.pushState.bind(history);
  history.pushState = (...a) => { origPush(...a); onNav(); };
  window.addEventListener('popstate', onNav);
  setInterval(() => { if (window.location.href !== lastUrl) { lastUrl = window.location.href; onNav(); } }, 500);

  function onNav() {
    if (!isPro || !platformEnabled) return;
    lastUrl = window.location.href;
    detectOwnProfile();
    if (!isEnabled) return;

    const allowed = isAllowedPage() || isOwnContent();
    document.body?.classList.toggle('ns-allowed-page', focusMode && allowed);

    if (focusMode && !allowed) {
      NS_SHARED.showFocusModeOverlay(getProfileUrl(), 'Return to profile');
      return;
    }

    if (allowed) {
      NS_SHARED.removeFocusModeOverlay();
    }
  }

  // ── Check page types ────────────────────────────────────────────────────────
  function isReelsPage() {
    const path = window.location.pathname;
    return path.startsWith('/reels') || path.startsWith('/watch') || path.startsWith('/reel/');
  }

  function isFBPostImage(img) {
    const src = img.src || img.getAttribute('src') || '';
    if (!src.includes('fbcdn.net') && !src.includes('fbsbx.com')) return false;
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if ((w > 0 && w < 100) || (h > 0 && h < 100)) return false;
    return true;
  }

  // ── AUDIO OVERLAP FIX: Pause all other videos ───────────────────────────────
  function pauseAllVideosExcept(exceptVideo) {
    document.querySelectorAll('video').forEach(v => {
      if (v !== exceptVideo && !v.paused) {
        v.pause();
        v.muted = true;
      }
    });
    currentlyPlayingVideo = exceptVideo;
  }

  // ── Main blocking logic ─────────────────────────────────────────────────────
  function start() {
    processMedia();
    
    const mo = new MutationObserver((muts) => {
      if (!isEnabled) return;
      
      muts.forEach(m => {
        // Watch for src changes (lazy loading)
        if (m.type === 'attributes' && m.attributeName === 'src') {
          const el = m.target;
          if (el.tagName === 'IMG' && isFBPostImage(el) && !blocked.has(el) && !revealed.has(el)) {
            setTimeout(() => blockFeedItem(el), 60);
          }
        }
        
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          
          // Videos
          if (node.tagName === 'VIDEO' && !blocked.has(node) && !revealed.has(node)) {
            setTimeout(() => blockFeedItem(node), 60);
          }
          node.querySelectorAll?.('video').forEach(v => {
            if (!blocked.has(v) && !revealed.has(v)) setTimeout(() => blockFeedItem(v), 60);
          });
          
          // Images
          if (node.tagName === 'IMG' && isFBPostImage(node) && !blocked.has(node) && !revealed.has(node)) {
            setTimeout(() => blockFeedItem(node), 80);
          }
          node.querySelectorAll?.('img').forEach(img => {
            if (isFBPostImage(img) && !blocked.has(img) && !revealed.has(img)) setTimeout(() => blockFeedItem(img), 80);
          });
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    
    // Video play event listener for audio overlap fix
    document.addEventListener('play', (e) => {
      if (e.target.tagName === 'VIDEO') {
        pauseAllVideosExcept(e.target);
      }
    }, true);
  }

  function processMedia() {
    if (!isPro || !platformEnabled || !isEnabled) return;
    if (isOwnContent()) return;
    if (isOnMessagesPage()) return;
    if (focusMode && (isAllowedPage() || isOwnContent())) return;

    document.querySelectorAll('video').forEach(v => {
      if (!blocked.has(v) && !revealed.has(v)) setTimeout(() => blockFeedItem(v), 60);
    });
    document.querySelectorAll('img').forEach(img => {
      if (isFBPostImage(img) && !blocked.has(img) && !revealed.has(img)) setTimeout(() => blockFeedItem(img), 80);
    });
  }

  function blockFeedItem(el) {
    if (!isPro || !platformEnabled) return;
    if (blocked.has(el) || revealed.has(el)) return;
    if (isOwnContent()) { revealed.add(el); return; }
    if (isOnMessagesPage()) return;
    if (focusMode && (isAllowedPage() || isOwnContent())) return;

    blocked.add(el);
    
    const isVideo = el.tagName === 'VIDEO';
    const isImg = el.tagName === 'IMG';

    // Find container
    const container =
      el.closest('[data-pagelet*="FeedUnit"]') ||
      el.closest('[role="article"]') ||
      el.closest('[data-testid*="post"]') ||
      (isImg ? el.closest('a[href*="photo"]') || el.closest('div[class]') : null) ||
      el.parentElement?.parentElement || el.parentElement;

    if (!container) return;
    if (container.querySelector('.ns-inline-overlay')) return;

    // Check if this is an ad
    if (isAdElement(container)) {
      // Show "Ad removed by NoScroll" instead of friction overlay
      container.style.position = 'relative';
      NS_SHARED.injectStyle('ns-inline-styles', NS_SHARED.getInlineCSS());
      const overlay = document.createElement('div');
      overlay.className = 'ns-inline-overlay';
      overlay.innerHTML = NS_SHARED.buildAdRemovedHTML();
      container.appendChild(overlay);
      if (isVideo) { el.pause(); el.muted = true; }
      return;
    }

    // Reels page → full-screen overlay
    if (isReelsPage() && isVideo) {
      el.pause();
      overlayActive = true;
      chrome.runtime.sendMessage({ type: 'BLOCK_EVENT', platform: 'facebook' });
      showFullScreenOverlay(el);
      return;
    }

    // Home feed → inline per-item overlay
    if (isVideo) {
      el.pause();
      el.muted = true; // Mute to prevent audio overlap
      el.style.pointerEvents = 'none';
    }

    let duration = null;
    if (isVideo && el.duration && isFinite(el.duration)) duration = Math.round(el.duration);
    const fallback = isVideo ? 20 : 15;
    const secs = duration != null ? duration : fallback;
    const previewText = NS_SHARED.formatTimePreviewWithWillAndPlus(secs);

    container.style.position = 'relative';
    NS_SHARED.injectStyle('ns-inline-styles', NS_SHARED.getInlineCSS());

    const overlay = document.createElement('div');
    overlay.className = 'ns-inline-overlay';
    overlay.innerHTML = NS_SHARED.buildInlineHTML(customMessage, isImg ? 'Unblock Image' : 'Unblock Video', previewText);
    container.appendChild(overlay);

    chrome.runtime.sendMessage({ type: 'BLOCK_EVENT', platform: 'facebook' });

    NS_SHARED.observeScrollPast(container, {
      el,
      duration: secs,
      platform: 'facebook',
      isRevealed: (x) => revealed.has(x)
    });

    overlay.querySelector('[data-ns-reveal]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const btn = e.currentTarget;
      const delay = delaySeconds;
      
      NS_SHARED.createRevealCountdown(btn, delay, () => {
        revealed.add(el);
        overlay.remove();
        if (isVideo) {
          el.style.pointerEvents = '';
          el.muted = false;
          // Pause other videos before playing this one
          pauseAllVideosExcept(el);
        }
        container.style.position = '';
      });
    });
  }

  // ── Full-screen overlay for Reels ───────────────────────────────────────────
  function showFullScreenOverlay(video) {
    if (document.getElementById('ns-overlay')) return;

    let dur = null;
    if (video && typeof video.duration === 'number' && isFinite(video.duration) && video.duration > 0) dur = Math.round(video.duration);
    const fallback = 30;
    const getDisplayDuration = () => (dur != null && dur > 0) ? dur : fallback;
    let previewText = NS_SHARED.formatReturnToFacebookPreview(getDisplayDuration());
    if (dur == null && video) {
      video.addEventListener('loadedmetadata', () => {
        if (video.duration && isFinite(video.duration)) {
          dur = Math.round(video.duration);
          const el = document.querySelector('#ns-overlay .ns-saved');
          if (el) el.textContent = NS_SHARED.formatReturnToFacebookPreview(dur);
        }
      }, { once: true });
      if (video.readyState >= 1 && video.duration) { dur = Math.round(video.duration); previewText = NS_SHARED.formatReturnToFacebookPreview(dur); }
    }

    NS_SHARED.injectStyle('ns-styles', NS_SHARED.getOverlayCSS());

    const overlay = document.createElement('div');
    overlay.id = 'ns-overlay';
    const effectiveMessage = window.NoScrollFeatures ? NoScrollFeatures.getEffectiveMessage(customMessage, isPro) : customMessage;
    const effectiveDelay = window.NoScrollFeatures ? NoScrollFeatures.getEffectiveDelaySeconds(delaySeconds, isPro) : delaySeconds;
    overlay.innerHTML = `<div class="ns-container"><div class="ns-logo">NoScroll</div><div class="ns-circles"><div class="ns-circle ns-c1"></div><div class="ns-circle ns-c2"></div><div class="ns-circle ns-c3"></div></div><p class="ns-message" id="ns-message"></p><div class="ns-saved">${previewText}</div><div class="ns-btns" id="ns-btns"><button class="ns-btn-primary" id="ns-back">Return to Facebook</button><button class="ns-btn-ghost" id="ns-continue">Unblock This Video</button><button class="ns-btn-dark" id="ns-close">Close This Tab</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#ns-message').textContent = effectiveMessage;

    setTimeout(() => overlay.querySelector('.ns-btns')?.classList.add('ns-visible'), 1000);

    const sendTimeSavedOnSkip = () => {
      chrome.runtime.sendMessage({ type: 'SAVE_TIME', platform: 'facebook', seconds: (dur != null ? dur : fallback) });
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
      NS_SHARED.createRevealCountdown(btn, effectiveDelay, () => {
        revealed.add(video);
        removeOverlay();
        pauseAllVideosExcept(video);
        video.muted = false;
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
    const href = (window.location.href || '').toLowerCase();

    // Own profile (full safe zone)
    if (path.startsWith('/me') || (ownUsername && path.startsWith('/' + ownUsername))) return true;

    // Messages (always allowed)
    if (path.startsWith('/messages') || path.startsWith('/messenger') ||
        href.includes('/messages') || href.includes('/messenger')) return true;

    // Create post, edit profile, creator tools
    if (path.startsWith('/composer') || path.startsWith('/media') ||
        path.startsWith('/profile') || path.startsWith('/settings') ||
        path.includes('/creator') || path.includes('/professional_dashboard') ||
        path.includes('/about')) return true;

    // Pages, business
    if (path.startsWith('/pages/') || path.startsWith('/business/')) return true;

    return false;
  }

  function updateFocusIndicator() {
    NS_SHARED.removeFocusIndicator();
    if (showFocusIndicator) NS_SHARED.addFocusIndicator();
  }

  function enableFocusMode() {
    if (!document.getElementById('ns-focus-css')) {
      if (!isAllowedPage() && !isOwnContent()) {
        NS_SHARED.showFocusModeOverlay(getProfileUrl(), 'Return to profile');
      }
      const css = document.createElement('style');
      css.id = 'ns-focus-css';
      css.textContent = `
        /* Hide discovery feeds only when NOT on own profile/messages/allowed zone */
        body:not(.ns-allowed-page) [role="feed"],
        body:not(.ns-allowed-page) [data-pagelet="FeedUnit_0"],
        body:not(.ns-allowed-page) [data-pagelet*="FeedUnit"],
        body:not(.ns-allowed-page) [data-pagelet="Stories"],
        body:not(.ns-allowed-page) [data-pagelet="RightRail"],
        body:not(.ns-allowed-page) [data-pagelet*="Watch"],
        body:not(.ns-allowed-page) [data-pagelet*="Reels"],
        body:not(.ns-allowed-page) [data-pagelet*="Marketplace"],
        body:not(.ns-allowed-page) [data-pagelet*="Search"] {
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
