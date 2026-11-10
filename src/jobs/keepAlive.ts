import { env } from '@/config/env';
import { logger } from '@/utils/logger';

/**
 * Keep-alive ping for Render's free instance.
 *
 * Render puts a free web service to sleep after 15 minutes without inbound
 * traffic, and the next request then waits about a minute for it to wake.
 * Calling our own public /health URL every 10 minutes keeps it awake: the
 * request goes out through Render's edge and comes back in, so it counts as
 * inbound traffic.
 *
 * It can't wake a service that is already asleep (nothing is running to send
 * the ping), so it only prevents sleep while the process is up. Render can
 * still restart free services at any time.
 */

const REQUEST_TIMEOUT_MS = 10_000;

let timer: NodeJS.Timeout | null = null;
let consecutiveFailures = 0;

async function ping(): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const res = await fetch(env.keepAlive.url, {
      method: 'GET',
      headers: { 'user-agent': 'baba-isa-vanguard-keepalive/1.0' },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (consecutiveFailures > 0) {
      logger.info('Keep-alive recovered', { afterFailures: consecutiveFailures });
    }
    consecutiveFailures = 0;
    logger.info('Keep-alive ping ok', { ms: Date.now() - startedAt });
  } catch (error) {
    consecutiveFailures += 1;
    logger.warn('Keep-alive ping failed', {
      url: env.keepAlive.url,
      attempt: consecutiveFailures,
      reason: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function startKeepAlive(): void {
  if (!env.keepAlive.enabled || timer) return;

  const intervalMs = env.keepAlive.intervalMinutes * 60 * 1000;
  // unref: the timer never keeps the process alive during shutdown.
  timer = setInterval(() => void ping(), intervalMs);
  timer.unref();

  logger.info('Keep-alive started', { url: env.keepAlive.url, everyMinutes: env.keepAlive.intervalMinutes });
}

export function stopKeepAlive(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
