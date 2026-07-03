/**
 * Promise-based delay used to simulate network latency across mock services.
 */

export function delay(ms = 800): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Delay for a random duration within [min, max] ms — useful for making mocked
 * requests feel a little less uniform.
 */
export function randomDelay(min = 500, max = 950): Promise<void> {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  const ms = Math.floor(lower + Math.random() * (upper - lower));
  return delay(ms);
}

export default delay;
