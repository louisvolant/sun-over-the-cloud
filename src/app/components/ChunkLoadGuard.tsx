// src/app/components/ChunkLoadGuard.tsx

/**
 * Inline, dependency-free recovery for failed Next.js static chunk loads.
 *
 * A transient network failure or a stale cached HTML document can make the
 * `/_next/static/*` scripts fail, leaving the app unhydrated (the "first load
 * spins forever" symptom reported in Firefox). Because the failing chunks
 * include this component's own bundle, the guard cannot rely on React or on
 * any Next.js module: it is inlined in the initial HTML and runs while the
 * document is parsed.
 *
 * On the first failure it reloads the page once, adding `?chunk_retry=1` so a
 * genuinely broken environment can never trigger an infinite reload loop. The
 * flag is removed from the URL a few seconds after a successful load.
 */
const CHUNK_LOAD_GUARD = `
(function () {
  var RETRY_PARAM = 'chunk_retry';
  var STORAGE_KEY = 'sotc_chunk_reload_at';
  var COOLDOWN_MS = 30000;

  function hasRetried() {
    if (window.location.search.indexOf(RETRY_PARAM + '=1') !== -1) return true;
    try {
      var last = Number(window.sessionStorage.getItem(STORAGE_KEY) || 0);
      return last > 0 && Date.now() - last < COOLDOWN_MS;
    } catch (error) {
      return false;
    }
  }

  function reloadOnce() {
    window.__sotcChunkFailed = true;
    if (hasRetried()) return;
    try { window.sessionStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (error) {}
    try {
      var url = new URL(window.location.href);
      url.searchParams.set(RETRY_PARAM, '1');
      window.location.replace(url.toString());
    } catch (error) {
      window.location.reload();
    }
  }

  function isNextAsset(value) {
    return typeof value === 'string' && value.indexOf('/_next/static/') !== -1;
  }

  window.addEventListener('error', function (event) {
    var target = event.target;
    if (!target) return;
    if (target.tagName === 'SCRIPT' && isNextAsset(target.src)) reloadOnce();
    else if (target.tagName === 'LINK' && target.rel === 'stylesheet' && isNextAsset(target.href)) reloadOnce();
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    var message = String(reason && (reason.message || reason));
    if (/ChunkLoadError|Loading chunk|dynamically imported module|module script failed/i.test(message)) {
      reloadOnce();
    }
  });

  window.addEventListener('load', function () {
    if (window.__sotcChunkFailed) return;
    window.setTimeout(function () {
      if (window.__sotcChunkFailed) return;
      try {
        var url = new URL(window.location.href);
        if (url.searchParams.get(RETRY_PARAM) !== '1') return;
        url.searchParams.delete(RETRY_PARAM);
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      } catch (error) {}
    }, 3000);
  });
})();
`;

export default function ChunkLoadGuard() {
  return (
    <script
      id="chunk-load-guard"
      dangerouslySetInnerHTML={{ __html: CHUNK_LOAD_GUARD }}
    />
  );
}
