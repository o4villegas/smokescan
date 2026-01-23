/**
 * Custom Wait Utilities for E2E Tests
 * Helpers for waiting on specific conditions
 */

import { Page, expect } from '@playwright/test';

/**
 * Wait for a specific number of network requests to a URL pattern
 */
export async function waitForRequests(
  page: Page,
  urlPattern: string | RegExp,
  count: number,
  timeout: number = 30000
): Promise<void> {
  let requestCount = 0;

  const requestPromise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${count} requests to ${urlPattern}`));
    }, timeout);

    page.on('request', (request) => {
      const url = request.url();
      const matches = typeof urlPattern === 'string' ? url.includes(urlPattern) : urlPattern.test(url);

      if (matches) {
        requestCount++;
        if (requestCount >= count) {
          clearTimeout(timer);
          resolve();
        }
      }
    });
  });

  await requestPromise;
}

/**
 * Wait for a network response with specific status
 */
export async function waitForResponse(
  page: Page,
  urlPattern: string | RegExp,
  expectedStatus: number = 200,
  timeout: number = 30000
): Promise<Response> {
  const response = await page.waitForResponse(
    (response) => {
      const url = response.url();
      const matches = typeof urlPattern === 'string' ? url.includes(urlPattern) : urlPattern.test(url);
      return matches && response.status() === expectedStatus;
    },
    { timeout }
  );
  return response as unknown as Response;
}

/**
 * Wait for an element to have specific text content
 */
export async function waitForText(
  page: Page,
  selector: string,
  text: string,
  timeout: number = 10000
): Promise<void> {
  await page.waitForFunction(
    ({ sel, txt }) => {
      const element = document.querySelector(sel);
      return element && element.textContent?.includes(txt);
    },
    { sel: selector, txt: text },
    { timeout }
  );
}

/**
 * Wait for element count to reach a specific number
 */
export async function waitForElementCount(
  page: Page,
  selector: string,
  count: number,
  timeout: number = 10000
): Promise<void> {
  await page.waitForFunction(
    ({ sel, cnt }) => {
      const elements = document.querySelectorAll(sel);
      return elements.length === cnt;
    },
    { sel: selector, cnt: count },
    { timeout }
  );
}

/**
 * Wait for element to be removed from DOM
 */
export async function waitForElementRemoved(
  page: Page,
  selector: string,
  timeout: number = 10000
): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      return !element;
    },
    selector,
    { timeout }
  );
}

/**
 * Wait for no pending network requests (quiet network)
 */
export async function waitForQuietNetwork(
  page: Page,
  quietMs: number = 500,
  timeout: number = 30000
): Promise<void> {
  let pendingRequests = 0;
  let quietTimer: ReturnType<typeof setTimeout> | null = null;

  const networkPromise = new Promise<void>((resolve, reject) => {
    const timeoutTimer = setTimeout(() => {
      reject(new Error('Timeout waiting for quiet network'));
    }, timeout);

    const checkQuiet = () => {
      if (pendingRequests === 0) {
        quietTimer = setTimeout(() => {
          clearTimeout(timeoutTimer);
          resolve();
        }, quietMs);
      }
    };

    page.on('request', () => {
      pendingRequests++;
      if (quietTimer) {
        clearTimeout(quietTimer);
        quietTimer = null;
      }
    });

    page.on('requestfinished', () => {
      pendingRequests--;
      checkQuiet();
    });

    page.on('requestfailed', () => {
      pendingRequests--;
      checkQuiet();
    });

    // Initial check
    checkQuiet();
  });

  await networkPromise;
}

/**
 * Wait for localStorage to contain a specific key
 */
export async function waitForLocalStorageKey(
  page: Page,
  key: string,
  timeout: number = 10000
): Promise<string | null> {
  const value = await page.waitForFunction(
    (k) => {
      return localStorage.getItem(k);
    },
    key,
    { timeout }
  );
  return value.jsonValue();
}

/**
 * Wait for a console message matching a pattern
 */
export async function waitForConsoleMessage(
  page: Page,
  pattern: string | RegExp,
  timeout: number = 10000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for console message matching ${pattern}`));
    }, timeout);

    page.on('console', (msg) => {
      const text = msg.text();
      const matches = typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text);

      if (matches) {
        clearTimeout(timer);
        resolve(text);
      }
    });
  });
}

/**
 * Retry an action until it succeeds or timeout
 */
export async function retryUntilSuccess<T>(
  action: () => Promise<T>,
  options: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
  } = {}
): Promise<T> {
  const { timeout = 10000, interval = 100, errorMessage = 'Retry timeout' } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      return await action();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw new Error(errorMessage);
}

/**
 * Wait for URL to change to expected path
 */
export async function waitForNavigation(
  page: Page,
  expectedPath: string | RegExp,
  timeout: number = 10000
): Promise<void> {
  await page.waitForURL(expectedPath, { timeout });
}

/**
 * Wait for form validation state
 */
export async function waitForFormValid(
  page: Page,
  formSelector: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const form = document.querySelector(sel) as HTMLFormElement;
      return form && form.checkValidity();
    },
    formSelector,
    { timeout }
  );
}

/**
 * Wait for button to become enabled
 */
export async function waitForButtonEnabled(
  page: Page,
  buttonSelector: string,
  timeout: number = 5000
): Promise<void> {
  const button = page.locator(buttonSelector);
  await expect(button).toBeEnabled({ timeout });
}

/**
 * Wait for button to become disabled
 */
export async function waitForButtonDisabled(
  page: Page,
  buttonSelector: string,
  timeout: number = 5000
): Promise<void> {
  const button = page.locator(buttonSelector);
  await expect(button).toBeDisabled({ timeout });
}
