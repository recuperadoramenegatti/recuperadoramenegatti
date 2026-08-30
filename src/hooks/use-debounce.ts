'use client';

import { useEffect, useState } from 'react';

/**
 * Devolve o valor após `atraso` ms sem mudanças.
 * Usado no orçamento para não recalcular a cada tecla.
 */
export function useDebounce<T>(valor: T, atraso = 300): T {
  const [debounced, setDebounced] = useState(valor);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(valor), atraso);
    return () => clearTimeout(timer);
  }, [valor, atraso]);

  return debounced;
}
