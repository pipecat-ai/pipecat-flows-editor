import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hover state that lingers briefly after the pointer leaves, so it can travel
 * from an element to a control rendered beside it without the control
 * disappearing on the way.
 */
export function useHoverWithGrace(delayMs = 300) {
  const [hovering, setHovering] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback(
    (next: boolean) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      if (next) {
        setHovering(true);
      } else {
        timerRef.current = setTimeout(() => setHovering(false), delayMs);
      }
    },
    [delayMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return [hovering, set] as const;
}
