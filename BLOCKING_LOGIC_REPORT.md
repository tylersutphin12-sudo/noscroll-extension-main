# NoScroll v11 — Blocking Logic Report

## 1. Platforms with Blocking Logic

| Platform | Content Script | Status |
|----------|----------------|--------|
| **YouTube** | `content/youtube.js` | ✅ Implemented |
| **TikTok** | `content/tiktok.js` | ✅ Implemented |
| **Instagram** | `content/instagram.js` | ✅ Implemented |
| **Facebook** | `content/facebook.js` | ✅ Implemented |
| **X (Twitter)** | `content/twitter.js` | ✅ Implemented |
| **Reddit** | `content/reddit.js` | ✅ Implemented |

All six platforms have blocking logic. Each uses `shared.js` for overlay CSS, toast, and Focus Mode overlay helpers.

---

## 2. Mode Behaviors by Platform

### YouTube

| Mode | Behavior |
|------|----------|
| **Focus Mode** | • Full-screen overlay on Shorts feed (`/shorts`) unless viewing own content<br>• Blocks Shorts nav link clicks (toast: "Shorts feed hidden in Focus Mode")<br>• CSS hides: home feed, search results, watch-page recommendations, trending, Shorts shelf/nav, Subscriptions (sidebar and page)<br>• Allows: own channel, `/feed/you`, `/feed/library`, `/feed/history`, playlists, `/channel/`, `/@`, `/studio` |
| **Normal Mode** | • Full-screen overlay on Shorts feed (`/shorts`) with reveal countdown<br>• CSS hides: Shorts nav, Shorts shelf, reel shelves, Shorts chip<br>• Own content never blocked |

---

### TikTok

| Mode | Behavior |
|------|----------|
| **Focus Mode** | • Full-screen overlay on feed pages (`/`, `/foryou`, `/following`, `/tag/`, `/search`) unless on allowed page<br>• CSS hides: recommend list, video feed, search results<br>• Allows: `/@*` (profiles), `/upload`, `/creator`, `/analytics`, `/messages`, `/settings` |
| **Normal Mode** | • Per-video overlay when video scrolls into view (IntersectionObserver)<br>• Blocks videos in feed with reveal countdown<br>• Own content never blocked |

---

### Instagram

| Mode | Behavior |
|------|----------|
| **Focus Mode** | • Full-screen overlay on feed/explore unless on allowed page<br>• CSS hides: main feed articles, explore content, reels<br>• Allows: own profile, `/accounts/`, `/direct/`, `/create/`, `/settings/`, individual posts |
| **Normal Mode** | • Per-video overlay when video scrolls into view (IntersectionObserver)<br>• Blocks all videos (Reels, feed videos) with reveal countdown<br>• Own content never blocked |

---

### Facebook

| Mode | Behavior |
|------|----------|
| **Focus Mode** | • Full-screen overlay on disallowed pages<br>• CSS hides: `[role="feed"]`, FeedUnit, Stories, RightRail, Watch, Reels<br>• Allows: `/me`, `/profile`, `/settings`, `/pages`, `/business`, `/about`, own profile |
| **Normal Mode** | • **Reels page** (`/reels`, `/watch`, `/reel/`): full-screen overlay<br>• **Home feed**: inline per-item overlay on videos and images<br>• **Ads**: "Ad removed by NoScroll" (no reveal, permanent block)<br>• Own content never blocked |

---

### X (Twitter)

| Mode | Behavior |
|------|----------|
| **Focus Mode** | • Full-screen overlay on home (`/`, `/home`), explore (`/explore`), search (`/search`)<br>• CSS hides: timeline, primary column sections, trends sidebar<br>• Allows: own profile, `/settings`, `/compose`, `/analytics`, `/lists`, `/bookmarks`, `/messages` |
| **Normal Mode** | • Inline per-item overlay on images and videos in tweets (including replies/comments)<br>• Blocks: tweet photos, video players<br>• Own tweets never blocked |

---

### Reddit

| Mode | Behavior |
|------|----------|
| **Focus Mode** | • Full-screen overlay on home (`/`), subreddits (`/r/*`), search (`/search`)<br>• CSS hides: post containers, shreddit-post, main posts, frontpage sidebar<br>• Allows: own profile (`/user/*`), `/settings`, `/submit`, `/message`, saved, posts, comments |
| **Normal Mode** | • Inline per-item overlay on images and videos in posts<br>• Blocks: redd.it images, preview images, videos, shreddit-player<br>• Own posts never blocked |

---

## 3. Content Types Blocked by Platform

| Platform | Content Blocked | Overlay Type | Reveal Delay |
|----------|-----------------|--------------|--------------|
| **YouTube** | Shorts feed, Shorts shelf on home, Shorts nav link | Full-screen | Yes (configurable) |
| **TikTok** | Feed videos (For You, Following, tag, search) | Full-screen (per video) | Yes |
| **Instagram** | Reels, feed videos | Full-screen (per video) | Yes |
| **Facebook** | Reels (full-screen), feed videos, feed images | Full-screen (Reels) / Inline (feed) | Yes |
| **Facebook** | Sponsored/ads | Inline ("Ad removed") | No (permanent) |
| **X (Twitter)** | Tweet images, tweet videos | Inline per-item | Yes |
| **Reddit** | Post images (redd.it), post videos, shreddit-player | Inline per-item | Yes |

---

## 4. Common Patterns

- **Own content**: All platforms skip blocking for the user’s own content (channel, profile, posts).
- **Reveal flow**: All use a countdown (from `delaySeconds`) before revealing, except Facebook ads.
- **Focus Mode**: All show a full-screen overlay on feed/discovery pages and allow profile/settings.
- **Focus indicator**: Optional on-screen "Focus Mode On" pill when `showFocusModeIndicator` is true.
- **Platform toggle**: Each platform can be disabled via `platformEnabled` in storage.

---

## 5. Shared Utilities (shared.js)

- Overlay CSS (full-screen and inline)
- Focus Mode overlay HTML and helpers
- Focus indicator pill
- Toast notifications
- Reveal countdown helper
- Ad-removed overlay HTML
