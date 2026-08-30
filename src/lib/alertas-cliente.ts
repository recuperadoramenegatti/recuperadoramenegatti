/**
 * Utilidades de alerta que rodam no cliente.
 * Separadas de `lib/alertas.ts` porque aquele módulo importa o Prisma e não
 * pode entrar no bundle do navegador.
 */
import type { Alerta, NivelAlerta } from '@/types';

export const PESO_NIVEL: Record<NivelAlerta, number> = {
  critico: 0,
  alto: 1,
  medio: 2,
  baixo: 3,
};

/** Contagem por nível, para badges e filtros. */
export function contarPorNivel(alertas: Alerta[]): Record<NivelAlerta, number> {
  const contagem: Record<NivelAlerta, number> = { critico: 0, alto: 0, medio: 0, baixo: 0 };
  for (const a of alertas) contagem[a.nivel] += 1;
  return contagem;
}

/** Ordena por urgência e, dentro dela, por impacto financeiro. */
export function ordenarAlertas(alertas: Alerta[]): Alerta[] {
  return [...alertas].sort((a, b) => {
    const porNivel = PESO_NIVEL[a.nivel] - PESO_NIVEL[b.nivel];
    if (porNivel !== 0) return porNivel;
    return (b.impactoFinanceiro ?? 0) - (a.impactoFinanceiro ?? 0);
  });
}
