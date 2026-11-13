import { useEffect, useState } from 'react';

/** Valor que só muda depois de `delay` ms sem alterações (busca enquanto digita, sem uma chamada por tecla). */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
