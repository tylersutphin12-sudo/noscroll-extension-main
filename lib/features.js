// NoScroll - Free vs Pro feature gating
// Single source of truth. Replace isPro source with backend auth when ready.

const FREE_DELAY_SECONDS = 2;
const FREE_PLATFORM = 'youtube';
const DEFAULT_MESSAGE = 'Take a moment — is this worth your time?';

function isPro(cb) {
  if (typeof chrome?.storage?.local?.get !== 'function') {
    cb(false);
    return;
  }
  chrome.storage.local.get(['isPro'], (data) => cb(!!data.isPro));
}

function canUsePlatform(platformId, cb) {
  isPro((pro) => cb(pro ? true : platformId === FREE_PLATFORM));
}

function getEffectiveDelaySeconds(storedDelay, isProUser) {
  if (isProUser) return Math.min(10, Math.max(1, storedDelay ?? 1));
  return FREE_DELAY_SECONDS;
}

function getEffectiveMessage(storedMessage, isProUser) {
  return (isProUser && storedMessage && String(storedMessage).trim()) ? String(storedMessage).trim() : DEFAULT_MESSAGE;
}

if (typeof window !== 'undefined') {
  window.NoScrollFeatures = {
    FREE_DELAY_SECONDS,
    FREE_PLATFORM,
    DEFAULT_MESSAGE,
    isPro,
    canUsePlatform,
    getEffectiveDelaySeconds,
    getEffectiveMessage,
  };
}
