// src/lib/timeout.ts

/**
 * Resolves with the value of `promise`, or rejects after `ms` when the promise
 * does not settle in time.
 *
 * On Cloudflare Workers, some Node-only stacks (e.g. the MongoDB driver's TCP
 * sockets) can hang forever without ever resolving or rejecting. Wrapping such
 * calls with `withTimeout` guarantees the surrounding code always settles —
 * otherwise the runtime cancels the request with "Worker's code had hung".
 *
 * The handlers attached to the original promise consume its eventual result,
 * so a late rejection can never surface as an unhandled rejection.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}