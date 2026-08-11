// @ts-check

export const DEFAULT_NATIVE_COMMAND_TIMEOUT_MILLISECONDS = 15_000;
export const DEFAULT_LIFECYCLE_WAIT_TIMEOUT_MILLISECONDS = 10_000;
export const DEFAULT_LIFECYCLE_OPERATION_TIMEOUT_MILLISECONDS = 60_000;
export const DEFAULT_LIFECYCLE_READ_TIMEOUT_MILLISECONDS = 15_000;
export const DEFAULT_LIFECYCLE_RECOVERY_TIMEOUT_MILLISECONDS = 10_000;

export class LifecycleTimeoutError extends Error {
  /**
   * @param {string} layer
   * @param {number} timeoutMilliseconds
   */
  constructor(layer, timeoutMilliseconds) {
    super(
      `PortReeve lifecycle ${layer} exceeded its ${String(timeoutMilliseconds)}ms deadline.`,
    );
    this.name = 'LifecycleTimeoutError';
    this.code = 'lifecycle_timeout';
    this.layer = layer;
    this.timedOut = true;
    this.timeoutMilliseconds = timeoutMilliseconds;
  }
}

export class LifecycleDeadline {
  /**
   * @param {{
   *   timeoutMilliseconds: number,
   *   layer?: string,
   *   now?: () => number,
   *   setTimer?: typeof setTimeout,
   *   clearTimer?: typeof clearTimeout
   * }} options
   */
  constructor(options) {
    if (
      !Number.isFinite(options.timeoutMilliseconds) ||
      options.timeoutMilliseconds <= 0
    ) {
      throw new TypeError('Lifecycle deadline must be a positive finite duration.');
    }
    this.timeoutMilliseconds = options.timeoutMilliseconds;
    this.layer = options.layer ?? 'operation';
    this.now = options.now ?? Date.now;
    this.clearTimer = options.clearTimer ?? clearTimeout;
    this.startedAtMilliseconds = this.now();
    this.expiresAtMilliseconds = this.startedAtMilliseconds + this.timeoutMilliseconds;
    this.controller = new AbortController();
    const setTimer = options.setTimer ?? setTimeout;
    this.timer = setTimer(() => {
      this.controller.abort(this.error(this.layer));
    }, this.timeoutMilliseconds);
    this.timer.unref?.();
  }

  get signal() {
    return this.controller.signal;
  }

  remainingMilliseconds() {
    return Math.max(0, this.expiresAtMilliseconds - this.now());
  }

  /** @param {string} [layer] */
  assertActive(layer = this.layer) {
    if (this.signal.aborted || this.remainingMilliseconds() <= 0) {
      throw this.error(layer);
    }
  }

  /**
   * @param {string} [layer]
   * @param {number} [maximumMilliseconds]
   */
  commandOptions(
    layer = 'native-command',
    maximumMilliseconds = DEFAULT_NATIVE_COMMAND_TIMEOUT_MILLISECONDS,
  ) {
    this.assertActive(layer);
    return {
      signal: this.signal,
      timeoutMilliseconds: Math.max(
        1,
        Math.min(maximumMilliseconds, this.remainingMilliseconds()),
      ),
      timeoutLayer: layer,
    };
  }

  /**
   * @param {number} milliseconds
   * @param {string} [layer]
   */
  async wait(milliseconds, layer = 'wait') {
    this.assertActive(layer);
    const duration = Math.max(0, Math.min(milliseconds, this.remainingMilliseconds()));
    await new Promise((resolvePromise, reject) => {
      const finish = () => {
        this.signal.removeEventListener('abort', onAbort);
        resolvePromise(undefined);
      };
      const onAbort = () => {
        clearTimeout(timer);
        reject(this.error(layer));
      };
      const timer = setTimeout(finish, duration);
      this.signal.addEventListener('abort', onAbort, { once: true });
      Promise.resolve().then(() => {
        if (this.signal.aborted) onAbort();
      });
    });
    this.assertActive(layer);
  }

  finish() {
    this.clearTimer(this.timer);
  }

  /** @param {string} layer */
  error(layer) {
    return this.signal.reason instanceof LifecycleTimeoutError
      ? this.signal.reason
      : new LifecycleTimeoutError(layer, this.timeoutMilliseconds);
  }
}
