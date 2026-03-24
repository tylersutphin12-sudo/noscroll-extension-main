// NoScroll - Shared Utilities
// Common functions and styles used across all platform content scripts

const NS_SHARED = {
  // ── Default Settings ─────────────────────────────────────────────────────
  defaults: {
    delaySeconds: 1,
    customMessage: "Take a moment — is this worth your time?"
  },

  // ── Overlay CSS (Full-screen) ────────────────────────────────────────────
  getOverlayCSS() {
    return `#ns-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:#050505;z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:'Outfit',-apple-system,sans-serif;animation:nsAppear 0.3s ease-out;}@keyframes nsAppear{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.ns-container{text-align:center;max-width:500px;padding:40px 24px;}.ns-logo{font-size:11px;font-weight:700;color:#3B82F6;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:48px;}.ns-circles{position:relative;width:80px;height:80px;margin:0 auto 44px;}.ns-circle{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%;animation:nsBreathe 3s ease-in-out infinite;}.ns-c1{width:80px;height:80px;border:1.5px solid rgba(59,130,246,0.35)}.ns-c2{width:55px;height:55px;border:1.5px solid rgba(59,130,246,0.55);animation-delay:-1s}.ns-c3{width:30px;height:30px;background:rgba(59,130,246,0.25);box-shadow:0 0 20px rgba(59,130,246,0.6);animation-delay:-2s}@keyframes nsBreathe{0%,100%{opacity:0.4;transform:translate(-50%,-50%) scale(0.93)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.07)}}.ns-message{font-size:22px;font-weight:400;color:#EDEDED;line-height:1.55;margin-bottom:18px;animation:nsFadeIn 0.8s ease-out 0.3s both}@keyframes nsFadeIn{from{opacity:0}to{opacity:1}}.ns-saved{font-size:13px;font-weight:600;color:#10B981;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);display:inline-block;padding:5px 14px;border-radius:99px;margin-bottom:44px;animation:nsFadeIn 0.8s ease-out 0.6s both}.ns-btns{display:flex;flex-direction:column;gap:10px;align-items:center;opacity:0;transition:opacity 0.5s}.ns-btns.ns-visible{opacity:1}.ns-btn-ghost{background:transparent;color:#666;border:1px solid #1F1F1F;padding:11px 32px;border-radius:99px;font-size:13px;font-family:inherit;font-weight:500;cursor:pointer;min-width:220px;transition:color .2s,border-color .2s}.ns-btn-ghost:hover:not(:disabled){color:#EDEDED;border-color:#333}.ns-btn-ghost:disabled{cursor:default;color:#444}.ns-btn-primary{background:#3B82F6;color:#fff;border:none;padding:12px 32px;border-radius:99px;font-size:14px;font-family:inherit;font-weight:600;cursor:pointer;min-width:220px;transition:background-color .2s,box-shadow .2s}.ns-btn-primary:hover{background:#2563EB;box-shadow:0 0 20px rgba(59,130,246,0.4)}.ns-btn-dark{background:#111;color:#A1A1AA;border:1px solid #222;padding:11px 32px;border-radius:99px;font-size:13px;font-family:inherit;font-weight:500;cursor:pointer;min-width:220px;transition:background-color .2s,color .2s}.ns-btn-dark:hover{background:#1a1a1a;color:#EDEDED}`;
  },

  // ── Inline Overlay CSS (Per-item) ────────────────────────────────────────
  getInlineCSS() {
    return `.ns-inline-overlay{position:absolute;inset:0;background:rgba(5,5,5,0.98);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);z-index:99999;display:flex;align-items:center;justify-content:center;border-radius:inherit;font-family:'Outfit',-apple-system,sans-serif;}.ns-inline-content{text-align:center;padding:16px 20px;max-width:260px;}.ns-inline-logo{display:block;font-size:10px;font-weight:700;color:#3B82F6;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:10px;}.ns-inline-msg{font-size:13px;color:#EDEDED;line-height:1.45;margin-bottom:14px;}.ns-inline-preview{font-size:11px;color:#10B981;margin-bottom:12px;}.ns-inline-btn{background:#3B82F6;color:#fff;border:none;padding:8px 20px;border-radius:99px;font-size:12px;font-family:inherit;font-weight:600;cursor:pointer;transition:background-color 0.2s;white-space:nowrap;}.ns-inline-btn:hover{background:#2563EB}.ns-inline-btn:disabled{opacity:0.6;cursor:default}`;
  },

  // ── Focus Mode CSS (persistent on-screen indicator) ───────────────────────
  getFocusIndicatorCSS() {
    return `.ns-focus-indicator{position:fixed;bottom:16px;right:16px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.35);box-shadow:0 0 12px rgba(59,130,246,0.25);padding:6px 12px;border-radius:99px;font-family:'Outfit',-apple-system,sans-serif;font-size:10px;font-weight:600;color:#3B82F6;z-index:2147483645;display:flex;align-items:center;gap:5px;}.ns-focus-dot{width:5px;height:5px;background:#3B82F6;border-radius:50%;animation:nsFocusPulse 2s ease-in-out infinite;}@keyframes nsFocusPulse{0%,100%{opacity:0.5}50%{opacity:1}}`;
  },

  // ── Focus Mode overlay pulse (matches platform overlay ns-circles) ─
  getFocusPulseCSS() {
    return `.ns-circles{position:relative;width:80px;height:80px;margin:0 auto 44px;}.ns-circle{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%;animation:nsBreathe 3s ease-in-out infinite;}.ns-c1{width:80px;height:80px;border:1.5px solid rgba(59,130,246,0.35)}.ns-c2{width:55px;height:55px;border:1.5px solid rgba(59,130,246,0.55);animation-delay:-1s}.ns-c3{width:30px;height:30px;background:rgba(59,130,246,0.25);box-shadow:0 0 20px rgba(59,130,246,0.6);animation-delay:-2s}@keyframes nsBreathe{0%,100%{opacity:0.4;transform:translate(-50%,-50%) scale(0.93)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.07)}}`;
  },
  getFocusPulseHTML() {
    return `<div class="ns-circles"><div class="ns-circle ns-c1"></div><div class="ns-circle ns-c2"></div><div class="ns-circle ns-c3"></div></div>`;
  },

  // ── Toast CSS ────────────────────────────────────────────────────────────
  getToastCSS() {
    return `#ns-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#0A0A0A;border:1px solid #1F1F1F;color:#EDEDED;padding:12px 22px;border-radius:99px;font-size:13px;font-family:'Outfit',-apple-system,sans-serif;font-weight:500;z-index:2147483647;box-shadow:0 8px 24px rgba(0,0,0,0.7);animation:nsToastIn .25s ease-out;white-space:nowrap;}@keyframes nsToastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
  },

  // ── Inject Style Utility ─────────────────────────────────────────────────
  injectStyle(id, css) {
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  },

  // ── Show Toast ───────────────────────────────────────────────────────────
  showToast(msg) {
    if (document.getElementById('ns-toast')) return;
    this.injectStyle('ns-toast-style', this.getToastCSS());
    const t = document.createElement('div');
    t.id = 'ns-toast';
    t.innerHTML = `<span style="color:#3B82F6;margin-right:8px;font-weight:700;">NS</span>${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  },

  // ── Build Full-Screen Overlay HTML ───────────────────────────────────────
  buildOverlayHTML(message, saved, revealLabel = 'Reveal Content') {
    return `<div class="ns-container"><div class="ns-logo">NoScroll</div><div class="ns-circles"><div class="ns-circle ns-c1"></div><div class="ns-circle ns-c2"></div><div class="ns-circle ns-c3"></div></div><p class="ns-message">${message}</p><div class="ns-saved">${saved}</div><div class="ns-btns" id="ns-btns"><button class="ns-btn-ghost" id="ns-continue">${revealLabel}</button><button class="ns-btn-primary" id="ns-back">View Your Profile</button><button class="ns-btn-dark" id="ns-close">Close Tab</button></div></div>`;
  },

  // ── Build Inline Overlay HTML ────────────────────────────────────────────
  buildInlineHTML(message, label, previewText = null) {
    const preview = previewText ? `<p class="ns-inline-preview">${previewText}</p>` : '';
    return `<div class="ns-inline-content"><div class="ns-inline-logo">NS</div><p class="ns-inline-msg">${message}</p>${preview}<button class="ns-inline-btn" data-ns-reveal>${label}</button></div>`;
  },

  // ── Observe scroll-past: when container leaves viewport, call onScrollPast(seconds) if not revealed
  observeScrollPast(container, { el, duration, platform, isRevealed }) {
    if (!container || typeof chrome === 'undefined') return () => {};
    const saved = new WeakSet();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting && !saved.has(e.target)) {
          if (isRevealed && isRevealed(el)) return;
          saved.add(e.target);
          chrome.runtime.sendMessage({ type: 'SAVE_TIME', platform, seconds: duration });
        }
      }
    }, { threshold: 0 });
    io.observe(container);
    return () => io.disconnect();
  },

  // ── Build Ad Removed HTML ────────────────────────────────────────────────
  buildAdRemovedHTML() {
    return `<div class="ns-inline-content"><div class="ns-inline-logo">NS</div><p class="ns-inline-msg" style="color:#666;">Ad removed by NoScroll</p></div>`;
  },

  // ── Create Countdown Reveal ──────────────────────────────────────────────
  createRevealCountdown(btn, delay, onComplete, countdownLabel = 'Revealing') {
    let countdown = delay;
    btn.textContent = `${countdownLabel} in ${countdown}...`;
    btn.disabled = true;
    const iv = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(iv);
        onComplete();
      } else if (btn) {
        btn.textContent = `${countdownLabel} in ${countdown}...`;
      }
    }, 1000);
    return iv;
  },

  // ── Add Focus Mode Indicator (only when showFocusModeIndicator is true) ────
  addFocusIndicator() {
    if (document.getElementById('ns-focus-indicator')) return;
    this.injectStyle('ns-focus-indicator-css', this.getFocusIndicatorCSS());
    const indicator = document.createElement('div');
    indicator.id = 'ns-focus-indicator';
    indicator.className = 'ns-focus-indicator';
    indicator.innerHTML = '<span class="ns-focus-dot"></span>Creator Mode On';
    document.body.appendChild(indicator);
  },

  // ── Remove Focus Mode Indicator ──────────────────────────────────────────
  removeFocusIndicator() {
    document.getElementById('ns-focus-indicator')?.remove();
    document.getElementById('ns-focus-indicator-css')?.remove();
  },

  // ── Show Focus Mode Overlay ──────────────────────────────────────────────
  showFocusModeOverlay(profileUrl, profileLabel = 'View Your Profile', opts = {}) {
    if (document.getElementById('ns-focus-overlay')) return;
    const title = opts.title ?? 'Creator Mode ON';
    const message = opts.message ?? 'Distracting feeds are hidden.<br>Access your profile and content only.';
    const subText = opts.subText ?? '';
    this.injectStyle('ns-focus-pulse-css', this.getFocusPulseCSS());
    const overlay = document.createElement('div');
    overlay.id = 'ns-focus-overlay';
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:#050505;z-index:2147483646;display:flex;align-items:center;justify-content:center;font-family:'Outfit',-apple-system,sans-serif;`;
    overlay.innerHTML = `
      <div style="text-align:center;max-width:400px;padding:40px;">
        <div class="ns-logo" style="font-size:11px;font-weight:700;color:#3B82F6;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:48px;">NoScroll</div>
        ${this.getFocusPulseHTML()}
        <div style="font-size:11px;font-weight:700;color:#3B82F6;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:24px;">${title}</div>
        <p style="font-size:20px;color:#EDEDED;line-height:1.5;margin-bottom:24px;">${message}</p>
        ${subText ? `<p style="font-size:13px;color:#888;line-height:1.4;margin-bottom:24px;">${subText}</p>` : ''}
        <div style="display:flex;flex-direction:column;gap:10px;align-items:center;">
          <button id="ns-focus-profile" style="background:#3B82F6;color:#fff;border:none;padding:12px 28px;border-radius:99px;font-size:14px;font-weight:600;cursor:pointer;min-width:180px;">${profileLabel}</button>
          <button id="ns-focus-close" style="background:#111;color:#A1A1AA;border:1px solid #222;padding:10px 28px;border-radius:99px;font-size:13px;font-weight:500;cursor:pointer;min-width:180px;">Close Tab</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#ns-focus-profile')?.addEventListener('click', () => {
      window.location.href = profileUrl;
    });
    overlay.querySelector('#ns-focus-close')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'CLOSE_TAB' });
    });
  },

  // ── Remove Focus Mode Overlay ────────────────────────────────────────────
  removeFocusModeOverlay() {
    document.getElementById('ns-focus-overlay')?.remove();
    document.getElementById('ns-focus-pulse-css')?.remove();
  },

  // ── Format Saved Time ────────────────────────────────────────────────────
  formatSavedTime(seconds) {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `+${mins}m ${secs}s saved` : `+${mins}m saved`;
    }
    return `+${seconds}s saved`;
  },

  // ── Format time preview for overlay ("If you skip this, you save X") ───────
  formatTimePreview(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (s >= 60) {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return secs > 0 ? `If you skip this, you save ${mins} min ${secs} sec` : `If you skip this, you save ${mins} min`;
    }
    return `If you skip this, you save ${s} sec`;
  },

  // ── Format time preview for Facebook inline ("If you skip this, you will save +X") ─
  formatTimePreviewWithWillAndPlus(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (s >= 60) {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return secs > 0 ? `If you skip this, you will save +${mins} min ${secs} sec` : `If you skip this, you will save +${mins} min`;
    }
    return `If you skip this, you will save +${s} sec`;
  },

  // ── Format time preview for YouTube Normal Mode ("Return to YouTube to save +X") ─
  formatReturnToYouTubePreview(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (s >= 60) {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return secs > 0 ? `Return to YouTube to save +${mins} min ${secs} sec` : `Return to YouTube to save +${mins} min`;
    }
    return `Return to YouTube to save +${s} sec`;
  },

  // ── Format time preview for TikTok Normal Mode ("Return to TikTok to save +X") ─
  formatReturnToTikTokPreview(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (s >= 60) {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return secs > 0 ? `Return to TikTok to save +${mins} min ${secs} sec` : `Return to TikTok to save +${mins} min`;
    }
    return `Return to TikTok to save +${s} sec`;
  },

  // ── Format time preview for Instagram Normal Mode ("Return to Instagram to save +X") ─
  formatReturnToInstagramPreview(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (s >= 60) {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return secs > 0 ? `Return to Instagram to save +${mins} min ${secs} sec` : `Return to Instagram to save +${mins} min`;
    }
    return `Return to Instagram to save +${s} sec`;
  },

  // ── Format time preview for Facebook Normal Mode ("Return to Facebook to save +X") ─
  formatReturnToFacebookPreview(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (s >= 60) {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return secs > 0 ? `Return to Facebook to save +${mins} min ${secs} sec` : `Return to Facebook to save +${mins} min`;
    }
    return `Return to Facebook to save +${s} sec`;
  }
};

// Export for use in content scripts
if (typeof window !== 'undefined') {
  window.NS_SHARED = NS_SHARED;
}
