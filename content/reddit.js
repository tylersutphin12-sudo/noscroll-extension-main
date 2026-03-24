// NoScroll - Reddit
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
    platformEnabled = data.platformEnabled?.reddit !== false;
    showFocusIndicator = data.showFocusModeIndicator !== false;
    /* Free mode: Reddit does nothing. Only Pro + platform enabled runs. */
    if (!isPro || !platformEnabled) return;
    detectOwnUsername();
    if (isEnabled) start();
    if (isEnabled && focusMode) enableFocusMode();
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
      platformEnabled = changes.platformEnabled.newValue?.reddit !== false;
      if (!platformEnabled) { disableFocusMode(); removeAllOverlays(); }
      else if (isEnabled && isPro) { start(); if (focusMode) enableFocusMode(); }
    }
    if (changes.isPro) {
      isPro = !!changes.isPro.newValue;
      if (!isPro) { disableFocusMode(); removeAllOverlays(); }
      else if (isEnabled && platformEnabled) { start(); if (focusMode) enableFocusMode(); }
    }
  });

  // ── Detect own username ──────────────────────────────────────────────────────
  function detectOwnUsername() {
    // Find from user dropdown/menu
    const userLink = document.querySelector('a[href^="/user/me"], a[data-click-id="user"]');
    if (userLink?.href) {
      const match = userLink.href.match(/\/user\/([^\/\?]+)/);
      if (match && match[1] !== 'me') ownUsername = match[1];
    }
    
    // Fallback: check the header profile button
    if (!ownUsername) {
      const profileEl = document.querySelector('#header-subreddit-dropdown-a, [id*="header"] a[href*="/user/"]');
      if (profileEl?.href) {
        const match = profileEl.href.match(/\/user\/([^\/\?]+)/);
        if (match && match[1] !== 'me') ownUsername = match[1];
      }
    }
    
    // Fallback: any /user/ link in header/nav (works on comments page)
    if (!ownUsername) {
      const navLinks = document.querySelectorAll('header a[href*="/user/"], [role="banner"] a[href*="/user/"], nav a[href*="/user/"]');
      for (const el of navLinks) {
        const match = (el.href || '').match(/\/user\/([^\/\?]+)/);
        if (match && match[1] !== 'me') {
          ownUsername = match[1];
          break;
        }
      }
    }
    
    // Fallback: current URL if on own profile
    if (!ownUsername && window.location.pathname.startsWith('/user/')) {
      const pathUser = window.location.pathname.split('/user/')[1]?.split('/')[0];
      if (pathUser && pathUser !== 'me') ownUsername = pathUser;
    }
  }

  // ── Check if viewing own content ────────────────────────────────────────────
  function isOwnContent() {
    const path = window.location.pathname;
    
    // On own profile page
    if (ownUsername && path.startsWith('/user/' + ownUsername)) {
      return true;
    }
    
    // On settings/submit
    if (path.startsWith('/settings') || path.startsWith('/submit')) {
      return true;
    }
    
    // On comments page – allow if viewing comments for own post
    if (isCommentsPage(path) && isViewingOwnPostComments()) {
      return true;
    }
    
    return false;
  }

  // ── Comments page: /r/subreddit/comments/postid/... ────────────────────────
  function isCommentsPage(path) {
    return /^\/r\/[^/]+\/comments\/[^/]+/.test(path);
  }

  // ── Query selector including shadow DOM (for Reddit web components) ───────────
  function queryAllIncludingShadow(root, selector) {
    const results = [];
    try {
      root.querySelectorAll(selector).forEach(el => results.push(el));
      root.querySelectorAll('*').forEach(host => {
        if (host.shadowRoot) {
          queryAllIncludingShadow(host.shadowRoot, selector).forEach(el => results.push(el));
        }
      });
    } catch (_) {}
    return results;
  }

  // ── Check if post is by own user (includes shadow DOM) ───────────────────────
  function isOwnPost(container) {
    if (!ownUsername) return false;
    const authorLinks = queryAllIncludingShadow(container, 'a[href*="/user/"], a[href*="/u/"]');
    for (const link of authorLinks) {
      const href = (link.getAttribute('href') || link.href || '');
      const user = href.match(/\/(?:user|u)\/([^\/\?&#]+)/)?.[1];
      if (user && (user === ownUsername || decodeURIComponent(user) === ownUsername)) return true;
    }
    return false;
  }

  // ── Check if the post on this comments page belongs to the signed-in user ─────
  function isViewingOwnPostComments() {
    if (!ownUsername) return false;
    // Multiple selectors for Reddit's varying DOM structure; prefer main post area
    const containers = [
      document.querySelector('shreddit-post'),
      document.querySelector('[id^="t3_"]'),
      document.querySelector('[id^="post-"]'),
      document.querySelector('[data-testid="post-container"]'),
      document.querySelector('article[data-testid]'),
      document.querySelector('article.Post'),
      document.querySelector('.Post'),
      document.querySelector('[slot="post"]')?.parentElement,
      document.querySelector('main')?.querySelector('article, [id^="t3_"], shreddit-post')
    ].filter(Boolean);
    for (const container of containers) {
      if (container && isOwnPost(container)) return true;
    }
    // Fallback: first post-like block in main (before comments) – search including shadow DOM
    const main = document.querySelector('main, [role="main"], #main-content');
    if (main) {
      const firstPost = main.querySelector('shreddit-post, article, [id^="t3_"]');
      if (firstPost && isOwnPost(firstPost)) return true;
    }
    return false;
  }

  // ── Get profile URL (FIXED: no more loops) ──────────────────────────────────
  function getProfileUrl() {
    // Always return a direct URL, not /user/me which can cause loops
    if (ownUsername) {
      return `https://www.reddit.com/user/${ownUsername}`;
    }
    // Fallback to settings page which always works and is allowed
    return 'https://www.reddit.com/settings';
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

    applySafeZone();
  }

  function applySafeZone() {
    if (!isPro || !platformEnabled || !isEnabled) return;
    const path = window.location.pathname;
    const isBlockedPath = path === '/' || path.startsWith('/r/') || path.startsWith('/search');
    const allowed = isAllowedPage() || isOwnContent();

    document.body?.classList.toggle('ns-allowed-page', focusMode && allowed);

    if (focusMode && isBlockedPath) {
      // Comments page: post DOM loads async – retry before showing overlay
      if (isCommentsPage(path)) {
        const retryDelays = [0, 350, 750, 1200, 2000];
        retryDelays.forEach((delay) => {
          setTimeout(() => {
            if (!isPro || !platformEnabled || !isEnabled) return;
            detectOwnUsername();
            const allowedNow = isAllowedPage() || isOwnContent();
            document.body?.classList.toggle('ns-allowed-page', focusMode && allowedNow);
            if (allowedNow) {
              NS_SHARED.removeFocusModeOverlay();
            } else if (delay === retryDelays[retryDelays.length - 1]) {
              NS_SHARED.showFocusModeOverlay(getProfileUrl(), 'Return to profile');
            }
          }, delay);
        });
      } else {
        NS_SHARED.showFocusModeOverlay(getProfileUrl(), 'Return to profile');
      }
      return;
    }

    if (allowed || !isBlockedPath) {
      NS_SHARED.removeFocusModeOverlay();
    }
  }

  // ── Check if image is a post image ──────────────────────────────────────────
  function isRedditPostImage(img) {
    const src = img.src || '';
    return src.includes('i.redd.it') || 
           src.includes('preview.redd.it') || 
           src.includes('external-preview.redd.it');
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
          if (el.tagName === 'IMG' && isRedditPostImage(el) && !blocked.has(el) && !revealed.has(el)) {
            setTimeout(() => blockMedia(el), 50);
          }
        }
        
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          
          // Videos
          if ((node.tagName === 'VIDEO' || node.tagName === 'SHREDDIT-PLAYER') && !blocked.has(node) && !revealed.has(node)) {
            setTimeout(() => blockMedia(node), 50);
          }
          node.querySelectorAll?.('video, shreddit-player').forEach(el => {
            if (!blocked.has(el) && !revealed.has(el)) setTimeout(() => blockMedia(el), 50);
          });
          
          // Images
          if (node.tagName === 'IMG' && isRedditPostImage(node) && !blocked.has(node) && !revealed.has(node)) {
            setTimeout(() => blockMedia(node), 60);
          }
          node.querySelectorAll?.('img').forEach(img => {
            if (isRedditPostImage(img) && !blocked.has(img) && !revealed.has(img)) setTimeout(() => blockMedia(img), 60);
          });
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  }

  function processMedia() {
    if (!isPro || !platformEnabled || !isEnabled) return;
    if (window.location.pathname.startsWith('/message') || window.location.pathname.startsWith('/chat')) return;
    if (focusMode && (isAllowedPage() || isOwnContent())) return;

    document.querySelectorAll('video, shreddit-player').forEach(el => {
      if (!blocked.has(el) && !revealed.has(el)) blockMedia(el);
    });
    document.querySelectorAll('img').forEach(img => {
      if (isRedditPostImage(img) && !blocked.has(img) && !revealed.has(img)) blockMedia(img);
    });
  }

  function blockMedia(el) {
    if (!isPro || !platformEnabled) return;
    if (blocked.has(el) || revealed.has(el)) return;
    if (window.location.pathname.startsWith('/message') || window.location.pathname.startsWith('/chat')) return;
    if (focusMode && (isAllowedPage() || isOwnContent())) return;

    const isVideo = el.tagName === 'VIDEO' || el.tagName === 'SHREDDIT-PLAYER';
    const isImg = el.tagName === 'IMG';

    // Find the post container
    const postContainer = el.closest('[id^="post-"]') ||
                         el.closest('shreddit-post') ||
                         el.closest('article') ||
                         el.closest('.Post');
    
    // Skip if this is own content
    if (postContainer && isOwnPost(postContainer)) {
      revealed.add(el);
      return;
    }
    
    if (isOwnContent()) {
      revealed.add(el);
      return;
    }

    blocked.add(el);
    chrome.runtime.sendMessage({ type: 'BLOCK_EVENT', platform: 'reddit' });

    let duration = null;
    const vid = el.tagName === 'VIDEO' ? el : el.querySelector?.('video');
    if (isVideo && vid && vid.duration && isFinite(vid.duration)) duration = Math.round(vid.duration);
    const fallback = isVideo ? 15 : 15;
    const secs = duration != null ? duration : fallback;
    const previewText = NS_SHARED.formatTimePreviewWithWillAndPlus(secs);

    if (isVideo && el.tagName === 'VIDEO') {
      el.pause();
      el.style.pointerEvents = 'none';
    }

    const container =
      postContainer ||
      (isImg ? el.closest('figure') || el.closest('a[href*="redd.it"]') || el.parentElement?.parentElement : null) ||
      el.parentElement?.parentElement || el.parentElement;

    if (!container) return;
    if (container.querySelector('.ns-overlay-item')) return;
    container.style.position = 'relative';

    NS_SHARED.observeScrollPast(container, {
      el,
      duration: secs,
      platform: 'reddit',
      isRevealed: (x) => revealed.has(x)
    });

    // Inject styles with FIXED button alignment
    injectStyles();

    const overlay = document.createElement('div');
    overlay.className = 'ns-overlay-item';
    const effectiveMessage = window.NoScrollFeatures ? NoScrollFeatures.getEffectiveMessage(customMessage, isPro) : customMessage;
    const effectiveDelay = window.NoScrollFeatures ? NoScrollFeatures.getEffectiveDelaySeconds(delaySeconds, isPro) : delaySeconds;
    overlay.innerHTML = buildOverlayHTML(isImg ? 'Unblock Image' : 'Unblock Video', previewText, effectiveMessage);
    container.prepend(overlay);

    overlay.querySelector('[data-ns-reveal]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const btn = e.currentTarget;
      NS_SHARED.createRevealCountdown(btn, effectiveDelay, () => {
        revealed.add(el);
        overlay.remove();
        if (isVideo && el.tagName === 'VIDEO') {
          el.style.pointerEvents = '';
          el.play();
        }
        container.style.position = '';
      });
    });
  }

  // ── Build overlay HTML with proper centered layout ──────────────────────────
  function buildOverlayHTML(label, previewText = null, msg = null) {
    const preview = previewText ? `<p class="ns-item-preview">${previewText}</p>` : '';
    const message = msg != null ? msg : customMessage;
    return `<div class="ns-item-inner"><span class="ns-item-logo">NoScroll</span><p class="ns-item-msg">${message}</p>${preview}<button class="ns-item-btn" data-ns-reveal>${label}</button></div>`;
  }

  // ── Inject styles with FIXED alignment ──────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ns-item-styles')) return;
    const s = document.createElement('style');
    s.id = 'ns-item-styles';
    // Fixed: proper centering of content and button
    s.textContent = `
      .ns-overlay-item {
        position: absolute;
        inset: 0;
        background: rgba(5,5,5,0.98);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: inherit;
        font-family: 'Outfit', -apple-system, sans-serif;
      }
      .ns-item-inner {
        text-align: center;
        padding: 16px 20px;
        max-width: 260px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .ns-item-logo {
        display: block;
        font-size: 10px;
        font-weight: 700;
        color: #3B82F6;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        margin-bottom: 10px;
      }
      .ns-item-msg {
        font-size: 13px;
        color: #EDEDED;
        line-height: 1.45;
        margin-bottom: 14px;
        text-align: center;
      }
      .ns-item-preview {
        font-size: 11px;
        color: #10B981;
        margin-bottom: 12px;
      }
      .ns-item-btn {
        background: #3B82F6;
        color: #fff;
        border: none;
        padding: 8px 20px;
        border-radius: 99px;
        font-size: 12px;
        font-family: inherit;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
        white-space: nowrap;
        margin: 0 auto;
      }
      .ns-item-btn:hover {
        background: #2563EB;
      }
      .ns-item-btn:disabled {
        opacity: 0.6;
        cursor: default;
      }
    `;
    document.head.appendChild(s);
  }

  function removeAllOverlays() {
    document.querySelectorAll('.ns-overlay-item').forEach(o => o.remove());
  }

  // ── Focus Mode (Profile pages and messages — safe zone) ─────────────────────────
  // Profile pages = ANY /user/ route (own or other users). Fully unblocked in Focus Mode ON.
  function isAllowedPage() {
    const path = window.location.pathname;
    // Any profile page: /user/username (posts, comments, saved, overview, etc.)
    if (path.startsWith('/user/')) return true;
    // Settings, submit, messages, chat, account
    return path.startsWith('/settings') ||
           path.startsWith('/submit') ||
           path.startsWith('/message') ||
           path.startsWith('/chat') ||
           path.startsWith('/account');
  }

  function updateFocusIndicator() {
    NS_SHARED.removeFocusIndicator();
    if (showFocusIndicator) NS_SHARED.addFocusIndicator();
  }

  function enableFocusMode() {
    if (!document.getElementById('ns-focus-css')) {
      const css = document.createElement('style');
      css.id = 'ns-focus-css';
      css.textContent = `
        /* Hide feeds only when NOT on safe zone (own profile, messages, etc.) */
        body:not(.ns-allowed-page) [data-testid="post-container"],
        body:not(.ns-allowed-page) shreddit-post,
        body:not(.ns-allowed-page) main .post,
        body:not(.ns-allowed-page) [data-testid="frontpage-sidebar"] {
          display: none !important;
        }
        /* Focus Mode popup buttons: override Reddit global styles for proper centering */
        #ns-focus-overlay button {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          line-height: 1 !important;
          box-sizing: border-box !important;
          font-family: 'Outfit', -apple-system, sans-serif !important;
        }
      `;
      document.head.appendChild(css);
    }
    const path = window.location.pathname;
    const isBlockedPath = path === '/' || path.startsWith('/r/') || path.startsWith('/search');
    const allowed = isAllowedPage() || isOwnContent();
    document.body?.classList.toggle('ns-allowed-page', focusMode && allowed);
    if (showFocusIndicator) NS_SHARED.addFocusIndicator();
  }

  function disableFocusMode() {
    document.getElementById('ns-focus-css')?.remove();
    document.body?.classList.remove('ns-allowed-page');
    NS_SHARED.removeFocusIndicator();
    NS_SHARED.removeFocusModeOverlay();
  }
})();
