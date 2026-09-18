# Sun Over The Cloud

A progressive weather web application designed for exploring live meteorological conditions, multi-day forecasts, and monthly climate history graphs.

---

## Features

- **Live Weather & Forecasts**: Real-time temperature, feels-like, wind, humidity, sunrise/sunset, and precipitation data powered by MET Norway.
- **Monthly Climate History Graphs**: Interactive bar and line charts for monthly precipitation, humidity, and cloud cover powered by Open-Meteo.
- **Mobile-Optimized PWA Experience & Zoom Prevention**:
  - Native application feel with touch gestures configured to prevent accidental pinch and double-tap zooming (`viewport` non-scalable, `touch-action: pan-y`, `overflow-x: hidden`, `overscroll-behavior-x: none`, and WebKit gesture suppression).
  - **Complete Zoom/Unzoom Suppression in PWA Mode**: When launched as an installed PWA (detected via `display-mode: standalone`, `fullscreen`, `minimal-ui`, iOS Safari `navigator.standalone`, or PWA launch parameters), all unwanted zooming and unzooming gestures are strictly prevented to deliver an authentic native app experience:
    - **Trackpad Pinch & Wheel Zoom**: Intercepts `wheel` events with `ctrlKey` / `metaKey` to block macOS trackpad pinch gestures and Ctrl+Wheel zooming.
    - **Keyboard Zoom Shortcuts**: Intercepts `Ctrl` / `Cmd` combinations with `+`, `-`, `0`, `=`, and numpad keys.
    - **Multi-Touch Pinch-to-Zoom**: Suppresses multi-finger `touchstart` and `touchmove` events on mobile touchscreens without impacting single-touch interactions (such as dragging favorite cards).
    - **WebKit Native Gesture Suppression**: Captures and cancels iOS Safari `gesturestart`, `gesturechange`, and `gestureend` events.
    - **Double-Tap Zoom Protection**: Suppresses accidental double-tap zooming on non-interactive elements while preserving instant click responsiveness on buttons, links, and form fields.
    - **iOS Input Focus Stability**: Enforces minimum 16px font sizing on inputs and selects in PWA mode to prevent iOS Safari from automatically zooming into form fields.
  - **Preserved Browser Accessibility**: Outside of PWA standalone mode, standard desktop browser zoom shortcuts and pinch gestures remain fully operational for accessibility.
  - **Single-Line Header**: Seamless horizontal navigation on mobile. When authenticated, the account action compresses into a symbol button (`Settings` gear on Home, `Home` icon on Account).
  - **Mobile Sticky Footer Navigation**: A fixed bottom navigation bar on every page (mobile only) with three actions: **Home** (back to the weather page), **Search** (opens the dedicated full-page search view), and **My Account**. The bar respects the iOS safe area and a spacer keeps the page footer content from being hidden behind it.
  - **Dedicated Mobile Search Page (`/search`)**: A full-page search view (header/footer preserved) replacing a fragile overlay panel. Tapping a result row navigates home and displays that location (the weather is fetched, persisted and focused in the carousel via a `sessionStorage` hand-off). Logged-in users can also add a result to their favorites directly from the results with a star action.
  - **Swipeable Location Carousel (Mobile, Logged-In)**: On mobile, the home page is centered on a single location: a full-height weather view (current conditions, forecast and on-demand graphs — the same view as an expanded favorite card) that can be swiped horizontally to switch between all saved locations, with page indicator dots for quick jumps.
    - Built on native CSS scroll-snap (no carousel dependency); each slide scrolls vertically while swiping switches slides horizontally.
    - Every slide owns its data through the shared `useLocationWeather` hook: instant render from the IndexedDB cache, then transparent background refresh (same stale-while-revalidate lifecycle as favorite cards).
    - The last selected/searched location appears as an extra first slide while it does not match any favorite, and a fresh search selection (from the dedicated `/search` page) automatically brings its slide into view.
  - **Mobile Bottom Bar**: Language selector and logout button positioned cleanly at the bottom of the page before the footer.
- **Instant Visual Load via Local Database (IndexedDB & PWA Stale-While-Revalidate)**:
  - Local IndexedDB database (`sun_over_the_cloud_pwa_db`) stores weather snapshots, multi-day forecasts, and user favorites.
  - On app launch, cached information is rendered immediately (0ms visual delay) instead of waiting for network requests.
  - **Smart Expiration Filtering**: Expired past forecast hours from previous days or earlier today are automatically filtered out. When opening after an interval, current conditions are seamlessly projected from the forecast prediction for the current hour, preventing outdated historical metrics from being displayed.
  - **Transparent Background Synchronization**: Fresh meteorological observations and multi-day forecasts are fetched in the background from MET Norway, smoothly updating the interface and local IndexedDB store.
- **Favorite Locations on Home**:
  - When logged in, favorite locations are displayed as cards directly above the search bar (desktop; on mobile they are presented as the swipeable carousel described above).
  - Collapsed view displays location name, country flag, current temperature, and weather icon/condition with a quick un-favorite action button.
  - Clicking a favorite card smoothly expands it with lazy-loaded full-day and multi-day forecasts, while keeping monthly graphs accessible on-demand via a button.
  - **Drag & Drop Organization**: An "Organize" button next to "My Favorite Locations" activates reorder mode, enabling favorites to be repositioned via desktop drag-and-drop, mobile touch gestures, or accessible up/down controls with instantaneous IndexedDB persistence and background backend synchronization.
- **Interactive Search & "New City" Section**:
  - When favorites or popular cities are present, a dedicated "New city" section title clearly separates favorite cards from the location search input.
  - Autocomplete location search with geolocation fallback.
  - Search results include an immediate "Add to favorites" toggle button.
  - Last searched location can be dismissed via a close button, clearing cached weather and stored selection.
- **Forecast Display**:
  - First forecast group shows the next 24 hours of slots instead of the remaining calendar day.
  - Hourly slots and card padding compress on mobile to show at least 5 slots without scrolling.
- **Internationalization (i18n)**: Full support for English, French, and Spanish with persistent user preferences.
- **User Authentication & Accounts**: Secure Argon2 credential hashing, Google OAuth, session cookies, and account management.
- **Optimistic Auth**: Favorites render instantly from a local session flag, with background verification and a header sync spinner.
- **Footer External Projects**: Navigation links to companion projects including Currency Converter (`currency-converter.louisvolant.com`), Whois (`whois.louisvolant.com`), MyFilmList, FuelStats, OpenSkipass, and other web utilities.

---

## Configuration

Create a `.env.local` file in the project root with the required environment variables:

```env
# MongoDB Atlas
MONGODB_ATLAS_USERNAME=...
MONGODB_ATLAS_PASSWORD=...
MONGODB_ATLAS_CLUSTER_URL=...
MONGODB_ATLAS_DB_NAME=...
MONGODB_ATLAS_APP_NAME=...

# Session Cookie Secret
SESSION_COOKIE_KEY=...

# MET Norway User-Agent (Terms of Service requirement)
MET_NO_USER_AGENT=SunOverTheCloud/1.0 contact@yourdomain.com
```

---

## Getting Started

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Quality Verification

Before committing or pushing changes:

```bash
# Build production bundle
npm run build

# TypeScript validation
npx tsc --noEmit

# End-to-end tests
npx playwright test
```

---

## Cloudflare Workers Deployment

This app runs on Cloudflare Workers via the OpenNext Cloudflare adapter (`@opennextjs/cloudflare`).

### Architecture

- `open-next.config.ts` configures the `cloudflare-node` worker wrapper with `edge` converter, `fetch` external request proxy, and dummy incremental, tag, and queue caches, plus an external middleware using the `cloudflare-edge` wrapper and `node:crypto` as an edge external.
- `wrangler.toml` serves `.open-next/worker.js` with static assets from `.open-next/assets` (`ASSETS` binding), `compatibility_date = "2025-04-01"` and `nodejs_compat` flag. `keep_vars = true` preserves dashboard-managed variables on each deploy.
- `next.config.js` sets long-lived immutable caching for `/_next/static/*` and `no-cache, no-store, must-revalidate` for all other pages.
- Password hashing uses `hash-wasm` (pure WebAssembly argon2id) instead of native `argon2`, keeping the same PHC-encoded `$argon2id$v=19$` format so existing password hashes remain verifiable.
- **No axios in API routes**: outbound HTTP calls from API routes must use the native `fetch` — axios relies on the Node.js http stack and can hang on Cloudflare Workers until the runtime cancels the request ("Worker's code had hung").

### Environment Variables

All variables are managed via the Cloudflare dashboard or `wrangler secret put`. No `[vars]` block is committed:

```text
BACKEND_URL, FRONTEND_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MAILJET_API_KEY,
MAILJET_API_SECRET, MAILJET_SENDER_EMAIL, MET_NO_USER_AGENT, MONGODB_ATLAS_APP_NAME,
MONGODB_ATLAS_CLUSTER_URL, MONGODB_ATLAS_DB_NAME, MONGODB_ATLAS_PASSWORD,
MONGODB_ATLAS_USERNAME, NEXT_PUBLIC_BACKEND_URL, REDIRECT_URI, SESSION_COOKIE_KEY
```

For local development, copy these into `.env.local`.

### Commands

```bash
# Build for Cloudflare Workers (Next.js build plus OpenNext worker bundle)
npm run build

# Build and deploy to Cloudflare Workers
npm run deploy
```

The Cloudflare dashboard build command must run the OpenNext bundling step. Since `npm run build` already includes `opennextjs-cloudflare build`, keep the dashboard build command as `npm run build` with deploy command `npx wrangler deploy`.
