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

/**
 * Hard timeout applied to every MongoDB operation.
 *
 * On Cloudflare Workers the MongoDB driver talks to Atlas through the
 * `node:net` / `node:tls` compatibility shims, and those sockets are not part
 * of the runtime's I/O tracking. While such a socket is pending, the Workerd
 * hang detector can decide that the request will never produce a response and
 * cancel it ("error code: 1101"), even though the query usually completes in
 * under 100ms. Keeping a `setTimeout` pending around the operation gives the
 * runtime trackable work to wait on, so the query has the time to answer
 * instead of being killed mid-flight.
 */
export const DB_OPERATION_TIMEOUT_MS = 5_000;

/** Run a single MongoDB operation with {@link DB_OPERATION_TIMEOUT_MS}. */
export function withDbTimeout<T>(promise: Promise<T>): Promise<T> {
  return withTimeout(promise, DB_OPERATION_TIMEOUT_MS);
}