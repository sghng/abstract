/**
 * The serial queue: one publisher hit at a time, spaced by a minimum
 * interval with jitter. This pacing is what protects the institutional
 * entitlement; do not bypass it with direct route calls.
 */

const MIN_INTERVAL = Number(process.env.ABSTRACT_FETCH_INTERVAL ?? 6000);
const JITTER = 1500;

let chain: Promise<unknown> = Promise.resolve();
let lastStart = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastStart + MIN_INTERVAL + Math.random() * JITTER - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
    return job();
  });
  chain = run.catch(() => {});
  return run;
}
