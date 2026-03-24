// Estimated seconds saved per block event, by platform
const PLATFORM_SECONDS = {
  youtube: 20,
  tiktok: 25,
  instagram: 25,
  facebook: 20,
  twitter: 15,
  reddit: 15,
};

const DEFAULT_SECONDS = 20;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLOSE_TAB') {
    chrome.tabs.remove(sender.tab.id);
    return;
  }
  if (message.type === 'BLOCK_EVENT') {
    addBlockCountOnly(message.platform || null).then(() => sendResponse({ success: true }));
    return true;
  }
  if (message.type === 'SAVE_TIME') {
    addTimeSavedOnly(message.platform || null, message.seconds || 0).then(() => sendResponse({ success: true }));
    return true;
  }
});

async function addBlockCountOnly(platform) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['todayBlocks', 'totalBlocks', 'totalBlocked', 'lastStatDate', 'todayTimeSaved', 'totalTimeSaved', 'timeSaved'], (data) => {
      const now = new Date();
      const today = now.toDateString();
      const lastStatDate = data.lastStatDate || null;
      let todayBlocks = data.todayBlocks ?? 0;
      let todayTimeSaved = data.todayTimeSaved ?? 0;
      if (lastStatDate !== today) {
        todayBlocks = 0;
        todayTimeSaved = 0;
      }
      todayBlocks += 1;
      let totalBlocks = data.totalBlocks;
      if (totalBlocks == null) totalBlocks = data.totalBlocked || 0;
      totalBlocks += 1;
      let totalTimeSaved = data.totalTimeSaved;
      if (totalTimeSaved == null) totalTimeSaved = data.timeSaved?.allTime || 0;
      chrome.storage.local.set({
        todayBlocks,
        totalBlocks,
        todayTimeSaved,
        totalTimeSaved,
        lastStatDate: today,
      }, resolve);
    });
  });
}

async function addTimeSavedOnly(platform, seconds) {
  const s = Math.max(0, Math.round(seconds)) || ((platform && PLATFORM_SECONDS[platform]) || DEFAULT_SECONDS);
  return new Promise((resolve) => {
    chrome.storage.local.get(['todayTimeSaved', 'totalTimeSaved', 'lastStatDate', 'timeSaved'], (data) => {
      const now = new Date();
      const today = now.toDateString();
      const lastStatDate = data.lastStatDate || null;
      let todayTimeSaved = data.todayTimeSaved ?? 0;
      if (lastStatDate !== today) todayTimeSaved = 0;
      todayTimeSaved += s;
      let totalTimeSaved = data.totalTimeSaved;
      if (totalTimeSaved == null) totalTimeSaved = data.timeSaved?.allTime || 0;
      totalTimeSaved += s;
      chrome.storage.local.set({ todayTimeSaved, totalTimeSaved, lastStatDate: today }, resolve);
    });
  });
}
