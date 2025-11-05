"use client";

import { RefObject, useEffect, useRef } from "react";

/**
 * Hook for scrolling to an element in a map/collection by key.
 * Useful when you have multiple elements indexed by a key (e.g., function index, condition index).
 *
 * @param shouldScroll - When true, scroll to the element
 * @param elementKey - Key to look up in the refs map
 * @param refsMap - Map of keys to element refs
 * @param delay - Delay in milliseconds before scrolling (default: 100)
 * @param options - Additional scroll options (default: { behavior: "smooth", block: "center" })
 */
export function useScrollToKey<T extends HTMLElement>(
  shouldScroll: boolean,
  elementKey: number | string | null,
  refsMap: RefObject<Map<number | string, T>>,
  delay = 100,
  options: ScrollIntoViewOptions = { behavior: "smooth", block: "center" }
) {
  const prevKeyRef = useRef<number | string | null>(null);
  const prevShouldScrollRef = useRef<boolean>(false);

  useEffect(() => {
    // Only scroll if:
    // 1. shouldScroll is true
    // 2. elementKey is not null
    // 3. Either the key changed OR shouldScroll changed from false to true
    const keyChanged = prevKeyRef.current !== elementKey;
    const scrollJustEnabled = !prevShouldScrollRef.current && shouldScroll;

    if (shouldScroll && elementKey !== null && (keyChanged || scrollJustEnabled)) {
      prevKeyRef.current = elementKey;
      prevShouldScrollRef.current = shouldScroll;

      // Try multiple times with increasing delays to catch DOM updates
      let attemptCount = 0;
      const maxAttempts = 3;

      const tryScroll = () => {
        attemptCount++;
        const element = refsMap.current?.get(elementKey);

        if (element) {
          element.scrollIntoView(options);
        } else if (attemptCount < maxAttempts) {
          // Element not found yet, try again with a longer delay
          setTimeout(tryScroll, delay * attemptCount);
        }
      };

      const timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            tryScroll();
          });
        });
      }, delay);

      return () => {
        clearTimeout(timeoutId);
      };
    } else {
      // Update refs even when not scrolling
      prevKeyRef.current = elementKey;
      prevShouldScrollRef.current = shouldScroll;
    }
  }, [shouldScroll, elementKey, refsMap, delay, options]);
}
