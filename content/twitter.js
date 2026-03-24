// NoScroll - Twitter/X
// Intentional friction for media + Focus Mode
(function () {
  let isEnabled     = true;
  let focusMode     = false;
  let delaySeconds  = 1;
  let customMessage = "Take a moment — is this worth your time?";
  let lastUrl       = window.location.href;
  let ownUsername   = null;
  let platformEnabled = true;
  let showFocusIndicator = true;
  let isPro = false;

  const revealed    = new WeakSet();
  const blocked     = new WeakSet();

  chrome.storage.local.get(['enabled', 'customMessage', 'focusMode', 'delaySeconds', 'platformEnabled', 'showFocusModeIndicator', 'isPro'], (data) => {
    isEnabled     = data.enabled !== false;
    focusMode     = !!data.focusMode;
    isPro         = !!data.isPro;
    delaySeconds  = Math.min(10, Math.max(1, data.delaySeconds ?? 2));
    customMessage = (data.customMessage || '').trim() || "Take a moment — is this worth your time?";
    platformEnabled = data.platformEnabled?.twitter !== false;
    showFocusIndicator = data.showFocusModeIndicator !== false;
    /* Free mode: Twitter does nothing. Only Pro + platform enabled runs. */
    if (!isPro || !platformEnabled) return;
    detectOwnUsername();
    if (isEnabled) start();
    if (isEnabled && focusMode) {
      enableFocusMode();
      onNav();
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
      isEnabled = changes.enabled.newValue !== false;
      if (!isEnabled || !platformEnabled || !isPro) { disableFocusMode(); removeAllOverlays(); }
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
      platformEnabled = changes.platformEnabled.newValue?.twitter !== false;
      if (!platformEnabled) { disableFocusMode(); removeAllOverlays(); }
      else if (isEnabled && isPro) { start(); if (focusMode) enableFocusMode(); }
    }
    if (changes.isPro) {
      isPro = !!changes.isPro.newValue;
      if (!isPro) { disableFocusMode(); removeAllOverlays(); }
      else if (isEnabled && platformEnabled) { start(); if (focusMode) enableFocusMode(); onNav(); }
    }
  });

  // ── Detect own username ──────────────────────────────────────────────────────
  function detectOwnUsername() {
    // Find from profile link in sidebar
    const profileLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
    if (profileLink?.href) {
      const match = profileLink.href.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
      if (match) ownUsername = match[1];
    }
    
    // Fallback: find from account menu
    if (!ownUsername) {
      const accountMenu = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      const usernameEl = accountMenu?.querySelector('[dir="ltr"] span');
      if (usernameEl?.textContent?.startsWith('@')) {
        ownUsername = usernameEl.textContent.replace('@', '');
      }
    }
  }

  // ── Check if on messages (always allowed) ────────────────────────────────────
  function isOnMessagesPage() {
    const path = window.location.pathname;
    const href = (window.location.href || '').toLowerCase();
    return path.startsWith('/messages') || path.startsWith('/i/messages') ||
           href.includes('/messages');
  }

  // ── Check if viewing own content (own profile + all sub-paths) ────────────────
  function isOwnContent() {
    const path = window.location.pathname;

    // On own profile (posts, replies, media, likes, highlights, articles, etc.)
    if (ownUsername && (path === '/' + ownUsername || path.startsWith('/' + ownUsername + '/'))) {
      return true;
    }

    // Messages (always allowed)
    if (isOnMessagesPage()) return true;

    return false;
  }

  // ── Check if element is own content ─────────────────────────────────────────
  function isOwnTweet(container) {
    if (!ownUsername) return false;
    const authorLink = container.querySelector('a[href^="/"][role="link"]');
    if (authorLink) {
      const href = authorLink.getAttribute('href');
      if (href === '/' + ownUsername) return true;
    }
    return false;
  }

  // ── Get profile URL ─────────────────────────────────────────────────────────
  function getProfileUrl() {
    detectOwnUsername();
    const profileLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
    if (profileLink?.href) {
      const url = new URL(profileLink.href);
      url.hash = '';
      url.search = '';
      const path = url.pathname.replace(/\/+$/, '') || '/';
      if (path && path !== '/' && !['/home', '/explore', '/search', '/messages', '/settings', '/compose', '/notifications'].some(p => path.startsWith(p))) {
        return url.toString();
      }
    }
    if (ownUsername) {
      const domain = window.location.hostname.includes('x.com') ? 'x.com' : 'twitter.com';
      return `https://${domain}/${ownUsername}`;
    }
    const domain = window.location.hostname.includes('x.com') ? 'x.com' : 'twitter.com';
    return `https://${domain}/`;
  }

  // ── Navigation handling ─────────────────────────────────────────────────────
  const origPush = history.pushState.bind(history);
  history.pushState = (...a) => { origPush(...a); onNav(); };
  window.addEventListener('popstate', onNav);
  setInterval(() => { if (window.location.href !== lastUrl) { lastUrl = window.location.href; onNav(); } }, 500);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { onNav(); });
  }

  function onNav() {
    if (!isPro || !platformEnabled) return;
    lastUrl = window.location.href;
    detectOwnUsername();
    if (!isEnabled) return;

    const path = window.location.pathname;

    // Only show overlay for these explicit blocked paths (avoids loop when ownUsername
    // is not yet detected on profile load)
    const isBlockedPath = path === '/' || path === '/home' ||
      path.startsWith('/explore') || path.startsWith('/search');

    // Deferred re-check: own profile may load profile link after DOM ready
    const pathMatch = path.match(/^\/([^\/]+)\/?/);
    if (focusMode && !ownUsername && pathMatch && !['home', 'explore', 'search', 'messages', 'i', 'compose', 'settings', 'notifications'].includes(pathMatch[1]?.toLowerCase())) {
      setTimeout(() => { detectOwnUsername(); applySafeZone(); }, 150);
      setTimeout(() => { detectOwnUsername(); applySafeZone(); }, 500);
    }

    applySafeZone();
  }

  function applySafeZone() {
    if (!isPro || !platformEnabled || !isEnabled) return;
    const path = window.location.pathname;
    const isBlockedPath = path === '/' || path === '/home' ||
      path.startsWith('/explore') || path.startsWith('/search');
    const allowed = isAllowedPage() || isOwnContent();
    document.body?.classList.toggle('ns-allowed-page', focusMode && (allowed || !isBlockedPath));

    if (focusMode && isBlockedPath) {
      NS_SHARED.showFocusModeOverlay(getProfileUrl(), 'Return to profile');
      return;
    }

    if (allowed || !isBlockedPath) {
      NS_SHARED.removeFocusModeOverlay();
    }
  }

  // ── Check if image is a post image ──────────────────────────────────────────
  function isPostImage(img) {
    const src = img.src || '';
    // Tweet images from twimg CDN
    if (src.includes('pbs.twimg.com/media/')) return true;
    if (src.includes('pbs.twimg.com/ext_tw_video_thumb/')) return true;
    // Inside tweet photo container (main tweets AND replies/comments)
    if (img.closest('[data-testid="tweetPhoto"]')) return true;
    // Skip profile pictures and small images
    const w = img.naturalWidth || img.width || parseInt(img.getAttribute('width')) || 0;
    const h = img.naturalHeight || img.height || parseInt(img.getAttribute('height')) || 0;
    if ((w > 0 && w <= 48) || (h > 0 && h <= 48)) return false;
    return src.includes('twimg.com') && !src.includes('profile_images') && !src.includes('emoji');
  }

  // ── Main blocking logic ─────────────────────────────────────────────────────
  function start() {
    processMedia();
    
    const mo = new MutationObserver((muts) => {
      if (!isEnabled) return;
      
      muts.forEach(m => {
        // Watch for src changes
        if (m.type === 'attributes' && m.attributeName === 'src') {
          const el = m.target;
          if (el.tagName === 'IMG' && isPostImage(el) && !blocked.has(el) && !revealed.has(el)) {
            setTimeout(() => blockMedia(el), 50);
          }
        }
        
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          
          // Videos
          if (node.tagName === 'VIDEO' && !blocked.has(node) && !revealed.has(node)) {
            setTimeout(() => blockMedia(node), 50);
          }
          node.querySelectorAll?.('video').forEach(v => {
            if (!blocked.has(v) && !revealed.has(v)) setTimeout(() => blockMedia(v), 50);
          });
          
          // Images - including those in comments/replies
          if (node.tagName === 'IMG' && isPostImage(node) && !blocked.has(node) && !revealed.has(node)) {
            setTimeout(() => blockMedia(node), 60);
          }
          
          // Check for tweet photos (works for both main tweets and replies)
          node.querySelectorAll?.('[data-testid="tweetPhoto"] img').forEach(img => {
            if (!blocked.has(img) && !revealed.has(img)) setTimeout(() => blockMedia(img), 60);
          });
          
          // Also check article images (catches images in comment threads)
          node.querySelectorAll?.('article img').forEach(img => {
            if (isPostImage(img) && !blocked.has(img) && !revealed.has(img)) setTimeout(() => blockMedia(img), 60);
          });
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    
    // Periodic scan to catch any missed images
    setInterval(() => {
      if (isEnabled) scanForUnblockedMedia();
    }, 2000);
  }

  function processMedia() {
    if (!isPro || !platformEnabled || !isEnabled) return;
    if (isOnMessagesPage()) return;
    if (focusMode && (isAllowedPage() || isOwnContent())) return;

    // Block videos
    document.querySelectorAll('video').forEach(v => {
      if (!blocked.has(v) && !revealed.has(v)) blockMedia(v);
    });

    // Block images: tweetPhoto, article, cellInnerDiv (catch all tweet media)
    const imageSelectors = [
      '[data-testid="tweetPhoto"] img',
      'article img',
      '[data-testid="cellInnerDiv"] img'
    ];
    imageSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(img => {
        if (isPostImage(img) && !blocked.has(img) && !revealed.has(img)) blockMedia(img);
      });
    });
  }

  // Periodic scan to catch images that might have been missed
  function scanForUnblockedMedia() {
    if (!isPro || !platformEnabled) return;
    if (isOnMessagesPage()) return;
    if (focusMode && (isAllowedPage() || isOwnContent())) return;
    const imageSelectors = [
      '[data-testid="cellInnerDiv"] [data-testid="tweetPhoto"] img',
      '[data-testid="cellInnerDiv"] img',
      'article img'
    ];
    imageSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(img => {
        if (isPostImage(img) && !blocked.has(img) && !revealed.has(img)) blockMedia(img);
      });
    });
  }

  function blockMedia(el) {
    if (!isPro || !platformEnabled) return;
    if (blocked.has(el) || revealed.has(el)) return;
    if (isOnMessagesPage()) return;
    if (focusMode && (isAllowedPage() || isOwnContent())) return;

    const isVideo = el.tagName === 'VIDEO';
    const isImg = el.tagName === 'IMG';

    // Find the tweet container
    const tweetContainer = el.closest('article') || el.closest('[data-testid="tweet"]');
    
    // Skip if this is own content
    if (tweetContainer && isOwnTweet(tweetContainer)) {
      revealed.add(el);
      return;
    }
    
    if (isOwnContent()) {
      revealed.add(el);
      return;
    }

    blocked.add(el);
    chrome.runtime.sendMessage({ type: 'BLOCK_EVENT', platform: 'twitter' });

    let duration = null;
    if (isVideo && el.duration && isFinite(el.duration)) duration = Math.round(el.duration);
    const fallback = isVideo ? 20 : 15;
    const secs = duration != null ? duration : fallback;
    const previewText = NS_SHARED.formatTimePreviewWithWillAndPlus(secs);

    if (isVideo) {
      el.pause();
      el.muted = true;
      el.style.pointerEvents = 'none';
    }

    // Find container: article (feed view) has visible dimensions; tweetPhoto (detail view) works for media
    let container = isImg
      ? (el.closest('article') ||
         el.closest('[data-testid="tweetPhoto"]') ||
         el.closest('a[href*="photo"]') ||
         el.closest('a[href*="status"]') ||
         el.closest('[data-testid="cellInnerDiv"]') ||
         (el.parentElement?.parentElement || el.parentElement))
      : (el.closest('article') ||
         el.closest('[data-testid="videoPlayer"]')?.parentElement ||
         el.closest('[data-testid="tweet"]') ||
         el.parentElement?.parentElement || el.parentElement);

    if (!container) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;display:inline-block;';
      el.parentNode?.insertBefore(wrapper, el);
      wrapper.appendChild(el);
      container = wrapper;
    }

    // Ensure container has visible dimensions (feed view may use inner wrappers with zero height)
    let c = container;
    for (let i = 0; i < 6 && c; i++) {
      if (c.offsetWidth > 0 && c.offsetHeight > 0) break;
      c = c.parentElement;
      if (c) container = c;
    }

    if (container.querySelector('.ns-inline-overlay')) return;

    container.style.position = 'relative';
    NS_SHARED.injectStyle('ns-inline-styles', NS_SHARED.getInlineCSS());

    const effectiveMessage = window.NoScrollFeatures ? NoScrollFeatures.getEffectiveMessage(customMessage, isPro) : customMessage;
    const effectiveDelay = window.NoScrollFeatures ? NoScrollFeatures.getEffectiveDelaySeconds(delaySeconds, isPro) : delaySeconds;
    const overlay = document.createElement('div');
    overlay.className = 'ns-inline-overlay';
    overlay.innerHTML = NS_SHARED.buildInlineHTML(effectiveMessage, isImg ? 'Unblock Image' : 'Unblock Video', previewText);
    container.appendChild(overlay);

    NS_SHARED.observeScrollPast(container, {
      el,
      duration: secs,
      platform: 'twitter',
      isRevealed: (x) => revealed.has(x)
    });

    overlay.querySelector('[data-ns-reveal]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const btn = e.currentTarget;
      NS_SHARED.createRevealCountdown(btn, effectiveDelay, () => {
        revealed.add(el);
        overlay.remove();
        if (isVideo) {
          el.style.pointerEvents = '';
          el.muted = false;
          el.play();
        }
        container.style.position = '';
      });
    });
  }

  function removeAllOverlays() {
    document.querySelectorAll('.ns-overlay-item, .ns-inline-overlay').forEach(o => o.remove());
  }

  // ── Focus Mode (Profile and messages only) ──────────────────────────────────
  function isAllowedPage() {
    const path = window.location.pathname;
    const href = (window.location.href || '').toLowerCase();

    // Own profile (full safe zone: posts, replies, media, likes, highlights, articles)
    if (ownUsername && (path === '/' + ownUsername || path.startsWith('/' + ownUsername + '/'))) {
      return true;
    }

    // Messages (always allowed)
    if (path.startsWith('/messages') || path.startsWith('/i/messages') ||
        href.includes('/messages')) return true;

    return false;
  }

  function updateFocusIndicator() {
    NS_SHARED.removeFocusIndicator();
    if (showFocusIndicator) NS_SHARED.addFocusIndicator();
  }

  function enableFocusMode() {
    if (!document.getElementById('ns-focus-css')) {
      const path = window.location.pathname;
      const isBlockedPath = path === '/' || path === '/home' ||
        path.startsWith('/explore') || path.startsWith('/search');
      if (focusMode && isBlockedPath) {
        NS_SHARED.showFocusModeOverlay(getProfileUrl(), 'Return to profile');
      }
      const css = document.createElement('style');
      css.id = 'ns-focus-css';
      css.textContent = `
        /* Hide feeds when NOT on own profile/messages */
        body:not(.ns-allowed-page) [data-testid="primaryColumn"] [aria-label*="Timeline"],
        body:not(.ns-allowed-page) [data-testid="primaryColumn"] section[role="region"],
        body:not(.ns-allowed-page) [data-testid="primaryColumn"] [data-testid="cellInnerDiv"],
        body:not(.ns-allowed-page) [data-testid="sidebarColumn"] [data-testid="trend"],
        body:not(.ns-allowed-page) [data-testid="primaryColumn"] [role="feed"],
        body:not(.ns-allowed-page) [data-testid="sidebarColumn"] {
          display: none !important;
        }
      `;
      document.head.appendChild(css);
    }
    const path = window.location.pathname;
    const isBlockedPath = path === '/' || path === '/home' ||
      path.startsWith('/explore') || path.startsWith('/search');
    const allowed = isAllowedPage() || isOwnContent();
    document.body?.classList.toggle('ns-allowed-page', focusMode && (allowed || !isBlockedPath));
    if (showFocusIndicator) NS_SHARED.addFocusIndicator();
  }

  function disableFocusMode() {
    document.getElementById('ns-focus-css')?.remove();
    document.body?.classList.remove('ns-allowed-page');
    NS_SHARED.removeFocusIndicator();
    NS_SHARED.removeFocusModeOverlay();
  }
})();
