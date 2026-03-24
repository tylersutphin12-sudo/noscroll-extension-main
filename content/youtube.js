// NoScroll - YouTube
// Intentional friction for Shorts + Focus Mode
// Users can always: view own channel, own Shorts, upload content, manage channel
(function () {
  let isEnabled     = true;
  let focusMode     = false;
  let delaySeconds  = 1;
  let customMessage = "Take a moment — is this worth your time?";
  let overlayActive = false;
  let lastUrl       = window.location.href;
  let ownChannelId  = null;
  let platformEnabled = true;
  let showFocusIndicator = true;
  let isPro = false;

  // ── Init ────────────────────────────────────────────────────────────────────
  chrome.storage.local.get(['enabled', 'customMessage', 'focusMode', 'delaySeconds', 'platformEnabled', 'showFocusModeIndicator', 'isPro'], (data) => {
    isEnabled     = data.enabled !== false;
    focusMode     = !!data.focusMode;
    isPro         = !!data.isPro;
    delaySeconds  = Math.min(10, Math.max(1, data.delaySeconds ?? 2));
    customMessage = (data.customMessage || '').trim() || "Take a moment — is this worth your time?";
    platformEnabled = data.platformEnabled?.youtube !== false;
    showFocusIndicator = data.showFocusModeIndicator !== false;
    detectOwnChannel();
    if (isEnabled && platformEnabled) { injectShortsCSS(); checkAndBlock(); runHideLoop(); }
    if (isEnabled && focusMode && platformEnabled) { enableFocusMode(); }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
      isEnabled = changes.enabled.newValue !== false;
      if (!isEnabled || !platformEnabled) { removeShortsCSS(); removeOverlay(); disableFocusMode(); removeHomeBlankState(); }
      else { injectShortsCSS(); checkAndBlock(); runHideLoop(); if (focusMode) enableFocusMode(); }
    }
    if (changes.customMessage) {
      customMessage = (changes.customMessage.newValue || '').trim() || "Take a moment — is this worth your time?";
      const m = document.getElementById('ns-message');
      if (m) m.textContent = customMessage;
    }
    if (changes.focusMode) {
      focusMode = !!changes.focusMode.newValue;
      if (focusMode && isEnabled && platformEnabled) enableFocusMode();
      else disableFocusMode();
    }
    if (changes.showFocusModeIndicator) {
      showFocusIndicator = changes.showFocusModeIndicator.newValue !== false;
      if (focusMode && isEnabled && platformEnabled) updateFocusIndicator();
    }
    if (changes.delaySeconds) {
      delaySeconds = Math.min(10, Math.max(1, changes.delaySeconds.newValue ?? 1));
    }
    if (changes.platformEnabled) {
      platformEnabled = changes.platformEnabled.newValue?.youtube !== false;
      if (!platformEnabled) { removeShortsCSS(); removeOverlay(); disableFocusMode(); removeHomeBlankState(); }
      else if (isEnabled) { injectShortsCSS(); checkAndBlock(); runHideLoop(); if (focusMode) enableFocusMode(); }
    }
    if (changes.isPro) {
      isPro = !!changes.isPro.newValue;
    }
  });

  // ── Detect own channel ──────────────────────────────────────────────────────
  function detectOwnChannel() {
    // Try to find channel ID from the account menu or page
    const channelLink = document.querySelector('a[href*="/channel/"][id*="avatar"], ytd-guide-entry-renderer a[href*="/@"]');
    if (channelLink) {
      const href = channelLink.getAttribute('href');
      if (href.includes('/channel/')) {
        ownChannelId = href.split('/channel/')[1]?.split('/')[0];
      } else if (href.includes('/@')) {
        ownChannelId = href.split('/@')[1]?.split('/')[0];
      }
    }
  }

  // ── Check if viewing own content ────────────────────────────────────────────
  function isOwnContent() {
    const path = window.location.pathname;
    
    // On own channel page
    if (path.startsWith('/feed/you') || path.startsWith('/channel/' + ownChannelId) || 
        (ownChannelId && path.includes('/@' + ownChannelId))) {
      return true;
    }
    
    // Check if the current Shorts video is on own channel
    const channelElement = document.querySelector('ytd-channel-name a, #owner-name a, [itemprop="author"] a');
    if (channelElement && ownChannelId) {
      const href = channelElement.getAttribute('href') || '';
      if (href.includes(ownChannelId) || href.includes('/@' + ownChannelId)) {
        return true;
      }
    }
    
    return false;
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  const origPush = history.pushState.bind(history);
  history.pushState = (...a) => { origPush(...a); onNav(); };
  window.addEventListener('popstate', onNav);
  window.addEventListener('yt-navigate-finish', onNav);
  window.addEventListener('yt-page-data-updated', onNav);
  setInterval(() => { if (window.location.href !== lastUrl) { lastUrl = window.location.href; onNav(); } }, 400);

  function onNav() {
    lastUrl = window.location.href;
    detectOwnChannel();
    if (!isEnabled) { removeOverlay(); removeHomeBlankState(); return; }
    if (!platformEnabled) { removeOverlay(); removeHomeBlankState(); disableFocusMode(); return; }
    if (!isHomePage()) removeHomeBlankState();
    if (focusMode) removeHomeBlankState();

    /* Creator Mode: redirect Subscriptions page away — block access fully */
    if (focusMode && isSubscriptionsPage()) {
      window.location.replace('https://www.youtube.com/feed/you');
      return;
    }

    if (focusMode && isHomePage() && !isOwnContent()) {
      showFocusModeOverlay();
      return;
    }

    if (isSubscriptionsPage()) {
      setTimeout(() => { checkAndBlock(); hideShortElements(); }, 300);
      return;
    }

    if (!focusMode && isHomePage()) {
      hideHomeFeed();
      setTimeout(() => { checkAndBlock(); hideShortElements(); }, 300);
      return;
    }

    if (focusMode && isShortUrl() && !isOwnContent()) {
      showFocusModeOverlay();
      return;
    }

    setTimeout(() => {
      checkAndBlock();
      hideShortElements();
      if (!focusMode && isWatchPage()) hideRecommendedFeed();
    }, 300);
  }

  // ── Shorts + Subscriptions tab intercept (Creator Mode) ───────────────────
  document.addEventListener('click', (e) => {
    if (!isEnabled) return;
    
    if (focusMode) {
      const shortsLink = e.target.closest('a[href="/shorts"], a[href^="/shorts/"]');
      if (shortsLink) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showToast('Shorts hidden in Creator Mode. Use YouTube Studio.');
        return;
      }
      const subsLink = e.target.closest('a[href="/feed/subscriptions"], a[href^="/feed/subscriptions?"]');
      if (subsLink) {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.href = 'https://www.youtube.com/feed/you';
        return;
      }
    }
    
    const guide = e.target.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
    if (guide && focusMode) {
      if (guide.querySelector('a[href="/shorts"]')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showToast('Shorts hidden in Creator Mode. Use YouTube Studio.');
      } else if (guide.querySelector('a[href="/feed/subscriptions"]')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.href = 'https://www.youtube.com/feed/you';
      }
    }
  }, true);

  function isShortUrl() { const p = window.location.pathname; return p === '/shorts' || p.startsWith('/shorts/'); }

  const isHomePage = () => location.pathname === '/' || location.pathname === '/home';
  const isSubscriptionsPage = () => location.pathname.startsWith('/feed/subscriptions');
  const isWatchPage = () => location.pathname.startsWith('/watch');

  // Home feed blank: persistent CSS + empty-state (Creator Mode OFF only)
  const HOME_BLANK_STYLE_ID = 'ns-home-blank-css';
  const HOME_BLANK_MSG_ID = 'ns-home-blank-msg';

  function ensureHomeBlankState() {
    if (!isEnabled || !platformEnabled || focusMode || !isHomePage()) return;
    if (document.getElementById(HOME_BLANK_STYLE_ID)) return;
    const css = document.createElement('style');
    css.id = HOME_BLANK_STYLE_ID;
    css.textContent = `
      /* YouTube homepage feed blank - Creator Mode OFF */
      ytd-browse[page-subtype="home"] ytd-rich-grid-renderer,
      ytd-browse[page-subtype="home"] ytd-rich-section-renderer,
      ytd-browse[page-subtype="home"] ytd-rich-shelf-renderer,
      ytd-browse[page-subtype="home"] ytd-rich-item-renderer { display: none !important; }
    `;
    document.head.appendChild(css);
    ensureHomeBlankMessage();
  }

  function ensureHomeBlankMessage() {
    if (document.getElementById(HOME_BLANK_MSG_ID)) return;
    if (!isHomePage()) return;
    const grid = document.querySelector('ytd-rich-grid-renderer');
    const parent = grid?.parentElement;
    if (!parent) {
      setTimeout(ensureHomeBlankMessage, 300);
      return;
    }
    const msg = document.createElement('div');
    msg.id = HOME_BLANK_MSG_ID;
    msg.setAttribute('data-ns-home-blank', '');
    msg.style.cssText = 'padding: 48px 24px; text-align: center; font-size: 13px; color: #71717A; font-family: "Outfit", -apple-system, sans-serif; line-height: 1.5;';
    msg.textContent = 'Home feed hidden by NoScroll';
    parent.insertBefore(msg, grid);
  }

  function removeHomeBlankState() {
    document.getElementById(HOME_BLANK_STYLE_ID)?.remove();
    document.getElementById(HOME_BLANK_MSG_ID)?.remove();
  }

  function hideHomeFeed() {
    ensureHomeBlankState();
  }

  function hideRecommendedFeed() {
    const sidebar = document.querySelector('#related');
    if (sidebar) sidebar.style.display = 'none';
  }

  function checkAndBlock() {
    if (!isEnabled || !platformEnabled) return;
    
    // Don't block own content
    if (isOwnContent()) {
      removeOverlay();
      return;
    }
    
    if (isShortUrl()) {
      if (focusMode) {
        showFocusModeOverlay();
      } else if (!overlayActive) {
        showBlockedOverlay();
      }
    } else {
      removeOverlay();
    }
  }

  // ── Shorts shelf CSS ──────────────────────────────────────────────────────
  function injectShortsCSS() {
    if (document.getElementById('ns-shorts-css')) return;
    const s = document.createElement('style'); s.id = 'ns-shorts-css';
    s.textContent = `
      ytd-guide-entry-renderer:has(a[href="/shorts"]),
      ytd-mini-guide-entry-renderer:has(a[href="/shorts"]) { display: none !important; }
      ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer, ytd-reel-item-renderer { display: none !important; }
      yt-chip-cloud-chip-renderer:has([title="Shorts"]) { display: none !important; }
    `;
    document.head.appendChild(s);
  }

  function removeShortsCSS() { document.getElementById('ns-shorts-css')?.remove(); }

  function hideShortElements() {
    document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer').forEach(el => {
      if (el.querySelector('a[href="/shorts"]')) el.style.setProperty('display', 'none', 'important');
      if (focusMode && el.querySelector('a[href="/feed/subscriptions"]')) el.style.setProperty('display', 'none', 'important');
      if (focusMode && el.querySelector('a[href^="/feed/subscriptions/"]')) el.style.setProperty('display', 'none', 'important');
    });
    if (focusMode) {
      document.querySelectorAll('ytd-guide-section-renderer').forEach(el => {
        if (el.querySelector('#expander-item') || el.querySelector('a[href^="/feed/subscriptions/"]'))
          el.style.setProperty('display', 'none', 'important');
      });
      document.querySelectorAll('ytd-guide-collapsible-section-renderer').forEach(el => {
        if (el.querySelector('a[href^="/feed/subscriptions"]'))
          el.style.setProperty('display', 'none', 'important');
      });
    }
    document.querySelectorAll('ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer, ytd-reel-item-renderer').forEach(el =>
      el.style.setProperty('display', 'none', 'important'));
    document.querySelectorAll('yt-chip-cloud-chip-renderer').forEach(chip => {
      if (chip.querySelector('yt-formatted-string')?.textContent.trim() === 'Shorts')
        chip.style.setProperty('display', 'none', 'important');
    });
  }

  function runHideLoop() {
    hideShortElements();
    if (isEnabled && !focusMode && isHomePage()) hideHomeFeed();
    else removeHomeBlankState();
    if (isEnabled && !focusMode && isWatchPage()) hideRecommendedFeed();
    setInterval(() => {
      if (isEnabled && !isShortUrl()) hideShortElements();
      if (isEnabled && !focusMode && isHomePage()) hideHomeFeed();
      else removeHomeBlankState();
      if (isEnabled && !focusMode && isWatchPage()) hideRecommendedFeed();
    }, 1500);
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg) {
    if (document.getElementById('ns-toast')) return;
    if (!document.getElementById('ns-toast-style')) {
      const s = document.createElement('style'); s.id = 'ns-toast-style';
      s.textContent = `#ns-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#0A0A0A;border:1px solid #1F1F1F;color:#EDEDED;padding:12px 22px;border-radius:99px;font-size:13px;font-family:'Outfit',-apple-system,sans-serif;font-weight:500;z-index:2147483647;box-shadow:0 8px 24px rgba(0,0,0,0.7);animation:nsToastIn .25s ease-out;white-space:nowrap;}@keyframes nsToastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
      document.head.appendChild(s);
    }
    const t = document.createElement('div'); t.id = 'ns-toast';
    t.innerHTML = `<span style="color:#3B82F6;margin-right:8px;font-weight:700;">NS</span>${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  // ── Full-screen Shorts overlay (intentional friction) ────────────────────
  function getShortDuration(videoEl) {
    if (!videoEl) return null;
    const d = videoEl.duration;
    if (typeof d === 'number' && isFinite(d) && d > 0) return Math.round(d);
    return null;
  }

  function showBlockedOverlay() {
    if (overlayActive) return;
    overlayActive = true;
    chrome.runtime.sendMessage({ type: 'BLOCK_EVENT', platform: 'youtube' });
    document.querySelector('video')?.pause();
    setTimeout(() => {
      const v = document.querySelector('video');
      let dur = getShortDuration(v);
      const fallback = 30;
      const getDisplayDuration = () => (dur != null && dur > 0) ? dur : fallback;
      let previewText = NS_SHARED.formatReturnToYouTubePreview(getDisplayDuration());

      if (dur == null && v) {
        const onMetadata = () => {
          dur = getShortDuration(v);
          if (dur != null) {
            const el = document.querySelector('#ns-overlay .ns-saved');
            if (el) el.textContent = NS_SHARED.formatReturnToYouTubePreview(dur);
          }
        };
        v.addEventListener('loadedmetadata', onMetadata, { once: true });
        if (v.readyState >= 1) onMetadata();
      }

      if (!document.getElementById('ns-styles')) {
        const s = document.createElement('style'); s.id = 'ns-styles'; s.textContent = getOverlayCSS();
        document.head.appendChild(s);
      }
      const effectiveMessage = window.NoScrollFeatures ? NoScrollFeatures.getEffectiveMessage(customMessage, isPro) : customMessage;
      const effectiveDelay = window.NoScrollFeatures ? NoScrollFeatures.getEffectiveDelaySeconds(delaySeconds, isPro) : delaySeconds;
      const overlay = document.createElement('div'); overlay.id = 'ns-overlay';
      overlay.innerHTML = `<div class="ns-container"><div class="ns-logo">NoScroll</div><div class="ns-circles"><div class="ns-circle ns-c1"></div><div class="ns-circle ns-c2"></div><div class="ns-circle ns-c3"></div></div><p class="ns-message" id="ns-message"></p><div class="ns-saved">${previewText}</div><div class="ns-btns" id="ns-btns"><button class="ns-btn-primary" id="ns-back">Return to YouTube</button><button class="ns-btn-ghost" id="ns-continue">Unblock This Video</button><button class="ns-btn-dark" id="ns-close">Close This Tab</button></div></div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#ns-message').textContent = effectiveMessage;
      setTimeout(() => overlay.querySelector('.ns-btns')?.classList.add('ns-visible'), 1000);

      const sendTimeSavedOnSkip = () => {
        const d = (dur != null && dur > 0) ? dur : fallback;
        chrome.runtime.sendMessage({ type: 'SAVE_TIME', platform: 'youtube', seconds: d });
      };

      overlay.querySelector('#ns-back')?.addEventListener('click', () => {
        sendTimeSavedOnSkip();
        window.location.href = 'https://www.youtube.com/feed/subscriptions';
      });
      overlay.querySelector('#ns-close')?.addEventListener('click', () => {
        sendTimeSavedOnSkip();
        chrome.runtime.sendMessage({ type: 'CLOSE_TAB' });
      });
      overlay.querySelector('#ns-continue')?.addEventListener('click', () => {
        const btn = overlay.querySelector('#ns-continue'); if (!btn) return;
        NS_SHARED.createRevealCountdown(btn, effectiveDelay, () => {
          removeOverlay();
          document.querySelector('video')?.play();
        });
      });
    }, 400);
  }

  function removeOverlay() {
    overlayActive = false;
    document.getElementById('ns-overlay')?.remove();
    document.getElementById('ns-styles')?.remove();
  }

  function getOverlayCSS() {
    return `#ns-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:#050505;z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:'Outfit',-apple-system,sans-serif;animation:nsAppear 0.3s ease-out;}@keyframes nsAppear{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.ns-container{text-align:center;max-width:500px;padding:40px 24px;}.ns-logo{font-size:11px;font-weight:700;color:#3B82F6;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:48px;}.ns-circles{position:relative;width:80px;height:80px;margin:0 auto 44px;}.ns-circle{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%;animation:nsBreathe 3s ease-in-out infinite;}.ns-c1{width:80px;height:80px;border:1.5px solid rgba(59,130,246,0.35)}.ns-c2{width:55px;height:55px;border:1.5px solid rgba(59,130,246,0.55);animation-delay:-1s}.ns-c3{width:30px;height:30px;background:rgba(59,130,246,0.25);box-shadow:0 0 20px rgba(59,130,246,0.6);animation-delay:-2s}@keyframes nsBreathe{0%,100%{opacity:0.4;transform:translate(-50%,-50%) scale(0.93)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.07)}}.ns-message{font-size:22px;font-weight:400;color:#EDEDED;line-height:1.55;margin-bottom:18px;animation:nsFadeIn 0.8s ease-out 0.3s both}.ns-subtitle{font-size:18px;font-weight:400;color:#EDEDED;line-height:1.55;margin-bottom:12px;animation:nsFadeIn 0.8s ease-out 0.35s both}.ns-helper{font-size:13px;color:#888;line-height:1.4;margin-bottom:18px;animation:nsFadeIn 0.8s ease-out 0.4s both}@keyframes nsFadeIn{from{opacity:0}to{opacity:1}}.ns-saved{font-size:13px;font-weight:600;color:#10B981;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);display:inline-block;padding:5px 14px;border-radius:99px;margin-bottom:44px;animation:nsFadeIn 0.8s ease-out 0.6s both}.ns-btns{display:flex;flex-direction:column;gap:10px;align-items:center;opacity:0;transition:opacity 0.5s}.ns-btns.ns-visible{opacity:1}.ns-btn-ghost{background:transparent;color:#666;border:1px solid #1F1F1F;padding:11px 32px;border-radius:99px;font-size:13px;font-family:inherit;font-weight:500;cursor:pointer;transition:color 0.2s,border-color 0.2s;min-width:220px}.ns-btn-ghost:hover:not(:disabled){color:#EDEDED;border-color:#333}.ns-btn-ghost:disabled{cursor:default;color:#444}.ns-btn-primary{background:#3B82F6;color:#fff;border:none;padding:12px 32px;border-radius:99px;font-size:14px;font-family:inherit;font-weight:600;cursor:pointer;transition:background-color 0.2s,box-shadow 0.2s;min-width:220px}.ns-btn-primary:hover{background:#2563EB;box-shadow:0 0 20px rgba(59,130,246,0.4)}.ns-btn-dark{background:#111;color:#A1A1AA;border:1px solid #222;padding:11px 32px;border-radius:99px;font-size:13px;font-family:inherit;font-weight:500;cursor:pointer;transition:background-color 0.2s,color 0.2s;min-width:220px}.ns-btn-dark:hover{background:#1a1a1a;color:#EDEDED}`;
  }

  function updateFocusIndicator() {
    NS_SHARED.removeFocusIndicator();
    if (showFocusIndicator) NS_SHARED.addFocusIndicator();
  }

  // ── Focus Mode - Blocks Shorts feed, discovery loops ─────────────────────────
  function isAllowedPage() {
    const path = window.location.pathname;
    if (path === '/' || path === '/home' || path === '/feed/trending') return false;
    if (path.startsWith('/feed/subscriptions')) return false;
    if (isShortUrl() && !isOwnContent()) return false;

    const allowedPaths = [
      '/feed/you',
      '/feed/library',
      '/feed/history',
      '/playlist',
      '/channel/',
      '/@',
      '/studio',
    ];
    return allowedPaths.some(p => path.startsWith(p) || path.includes(p));
  }

  function enableFocusMode() {
    if (!document.getElementById('ns-focus-css')) {
      if (!isAllowedPage() && !isOwnContent()) {
        showFocusModeOverlay();
      }
      const css = document.createElement('style');
      css.id = 'ns-focus-css';
      css.textContent = `
        /* Hide home feed */
        ytd-browse[page-subtype="home"] #contents.ytd-rich-grid-renderer,
        ytd-browse[page-subtype="home"] ytd-rich-grid-renderer,
        /* Hide search results */
        ytd-search #contents.ytd-section-list-renderer,
        /* Hide recommendations on watch page */
        ytd-watch-next-secondary-results-renderer,
        #related.ytd-watch-flexy,
        /* Hide trending */
        ytd-browse[page-subtype="trending"] #contents,
        /* Hide Shorts shelf and navigation */
        ytd-guide-entry-renderer:has(a[href="/shorts"]),
        ytd-mini-guide-entry-renderer:has(a[href="/shorts"]),
        ytd-rich-shelf-renderer[is-shorts],
        ytd-reel-shelf-renderer,
        /* Creator Mode: hide Subscriptions sidebar entry and channel list */
        ytd-guide-entry-renderer:has(a[href="/feed/subscriptions"]),
        ytd-mini-guide-entry-renderer:has(a[href="/feed/subscriptions"]),
        /* Hide subscriptions section with channel list (Show more / channel avatars) */
        ytd-guide-section-renderer:has(#expander-item),
        ytd-guide-section-renderer:has(a[href^="/feed/subscriptions/"]),
        ytd-guide-collapsible-section-renderer:has(a[href^="/feed/subscriptions"]),
        /* Hide individual subscription channel entries in sidebar */
        ytd-guide-entry-renderer:has(a[href^="/feed/subscriptions/"]) {
          display: none !important;
        }
      `;
      document.head.appendChild(css);
    }
    if (showFocusIndicator) NS_SHARED.addFocusIndicator();
  }

  function disableFocusMode() {
    document.getElementById('ns-focus-css')?.remove();
    document.getElementById('ns-focus-indicator')?.remove();
    document.getElementById('ns-focus-overlay')?.remove();
    document.getElementById('ns-focus-pulse-css')?.remove();
    if (isHomePage() && isEnabled && platformEnabled) hideHomeFeed();
  }

  function showFocusModeOverlay() {
    if (document.getElementById('ns-focus-overlay')) return;
    NS_SHARED.injectStyle('ns-focus-pulse-css', NS_SHARED.getFocusPulseCSS());
    const overlay = document.createElement('div');
    overlay.id = 'ns-focus-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #050505; z-index: 2147483646;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Outfit', -apple-system, sans-serif;
    `;
    overlay.innerHTML = `
      <div style="text-align: center; max-width: 400px; padding: 40px;">
        <div class="ns-logo" style="font-size: 11px; font-weight: 700; color: #3B82F6; letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 48px;">NoScroll</div>
        ${NS_SHARED.getFocusPulseHTML()}
        <div style="font-size: 11px; font-weight: 700; color: #3B82F6; letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 24px;">Creator Mode Active</div>
        <p style="font-size: 20px; color: #EDEDED; line-height: 1.5; margin-bottom: 8px;">
          YouTube discovery is hidden to keep you focused.
        </p>
        <p style="font-size: 13px; color: #888; line-height: 1.4; margin-bottom: 24px;">Search for videos or manage your channel.</p>
        <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
          <button id="ns-focus-return" style="background: #3B82F6; color: #fff; border: none; padding: 12px 28px; border-radius: 99px; font-size: 14px; font-weight: 600; cursor: pointer; min-width: 180px;">Return to YouTube</button>
          <button id="ns-focus-close" style="background: #111; color: #A1A1AA; border: 1px solid #222; padding: 10px 28px; border-radius: 99px; font-size: 13px; font-weight: 500; cursor: pointer; min-width: 180px;">Close This Tab</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#ns-focus-return')?.addEventListener('click', () => {
      window.location.href = 'https://www.youtube.com/feed/you';
    });
    overlay.querySelector('#ns-focus-close')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'CLOSE_TAB' });
    });
  }
})();
