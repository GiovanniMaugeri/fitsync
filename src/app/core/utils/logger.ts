import { isDevMode } from '@angular/core';

/**
 * Log centralizzato: `log` è silenzioso in produzione (rumore di debug),
 * `warn`/`error` restano sempre attivi per poter diagnosticare problemi reali
 * dalla console del browser di un utente in produzione.
 */
export const logger = {
  log: (...args: unknown[]): void => {
    if (isDevMode()) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  }
};
