import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `ms`
 * milliseconds have passed without further changes.
 */
export function useDebounce<T>(value: T, ms: number = 350): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(handle);
  }, [value, ms]);

  return debounced;
}
