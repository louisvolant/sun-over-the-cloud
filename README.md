# Sun Over The Cloud

A progressive weather web application designed for exploring live meteorological conditions, multi-day forecasts, and monthly climate history graphs.

---

## Features

- **Live Weather & Forecasts**: Real-time temperature, feels-like, wind, humidity, sunrise/sunset, and precipitation data powered by MET Norway.
- **Monthly Climate History Graphs**: Interactive bar and line charts for monthly precipitation, humidity, and cloud cover powered by Open-Meteo.
- **Mobile-Optimized PWA Experience**:
  - Native application feel with touch gestures configured to prevent accidental pinch and double-tap zooming (`viewport` non-scalable, `touch-action: pan-x pan-y`, and WebKit gesture suppression).
  - **Single-Line Header**: Seamless horizontal navigation on mobile. When authenticated, the account action compresses into a symbol button (`Settings` gear on Home, `Home` icon on Account).
  - **Mobile Bottom Bar**: Language selector and logout button positioned cleanly at the bottom of the page before the footer.
- **Instant Visual Load via Local Database (IndexedDB & PWA Stale-While-Revalidate)**:
  - Local IndexedDB database (`sun_over_the_cloud_pwa_db`) stores weather snapshots, multi-day forecasts, and user favorites.
  - On app launch, cached information is rendered immediately (0ms visual delay) instead of waiting for network requests.
  - **Smart Expiration Filtering**: Expired past forecast hours from previous days or earlier today are automatically filtered out. When opening after an interval, current conditions are seamlessly projected from the forecast prediction for the current hour, preventing outdated historical metrics from being displayed.
  - **Transparent Background Synchronization**: Fresh meteorological observations and multi-day forecasts are fetched in the background from MET Norway, smoothly updating the interface and local IndexedDB store.
- **Favorite Locations on Home**:
  - When logged in, favorite locations are displayed as cards directly above the search bar.
  - Collapsed view displays location name, country flag, current temperature, and weather icon/condition with a quick un-favorite action button.
  - Clicking a favorite card smoothly expands it with lazy-loaded full-day and multi-day forecasts, while keeping monthly graphs accessible on-demand via a button.
  - **Drag & Drop Organization**: An "Organize" button next to "My Favorite Locations" activates reorder mode, enabling favorites to be repositioned via desktop drag-and-drop, mobile touch gestures, or accessible up/down controls with instantaneous IndexedDB persistence and background backend synchronization.
- **Interactive Search & "New City" Section**:
  - When favorites or popular cities are present, a dedicated "New city" section title clearly separates favorite cards from the location search input.
  - Autocomplete location search with geolocation fallback.
  - Search results include an immediate "Add to favorites" toggle button.
- **Internationalization (i18n)**: Full support for English, French, and Spanish with persistent user preferences.
- **User Authentication & Accounts**: Secure Argon2 credential hashing, Google OAuth, session cookies, and account management.
- **Optimistic Auth**: Favorites render instantly from a local session flag, with background verification and a header sync spinner.
- **Footer External Projects**: Navigation links to companion projects including Whois (`whois.louisvolant.com`), MyFilmList, FuelStats, OpenSkipass, and other web utilities.

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
