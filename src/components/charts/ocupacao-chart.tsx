'use client';

import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MolduraGrafico, GraficoVazio, RAMPA_SEQUENCIAL, CORES_ESTADO } from '@/components/charts/base';
import { formatarHoras, formatarMoeda, formatarPercentual } from '@/lib/formatacao';
import { limitar } from '@/lib/utils';
import type { OcupacaoCentro } from '@/types';

/**
 * Ocupação por centro de custo.
 *
 * Barras em HTML puro em vez de Recharts: são cinco valores com rótulo
 * direto — uma biblioteca de gráficos aqui só adicionaria peso. A cor
 * codifica magnitude (rampa de hue única), e o percentual vem escrito ao
 * lado, então a leitura não depende dela.
 */
export function OcupacaoChart({
  centros,
  ociosidadeAlvo,
}: {
  centros: OcupacaoCentro[];
  ociosidadeAlvo: number;
}): React.JSX.Element {
  const alvoOcupacao = 100 - ociosidadeAlvo;
  const temDados = centros.some((c) => c.horasRealizadas > 0);

  const corDa = (pct: number): string => {
    if (pct <= 0) return 'rgba(255,255,255,0.10)';
    const indice = Math.min(
      RAMPA_SEQUENCIAL.length - 1,
      Math.floor((limitar(pct, 0, 100) / 100) * RAMPA_SEQUENCIAL.length),
    );
    return RAMPA_SEQUENCIAL[indice] ?? RAMPA_SEQUENCIAL[0];
  };

  return (
    <MolduraGrafico
      titulo="Ocupação por centro de custo"
      descricao={`Horas aplicadas sobre a capacidade · alvo de ${alvoOcupacao.toFixed(0)}%`}
      altura={Math.max(160, centros.length * 44 + 24)}
    >
      {!temDados ? (
        <GraficoVazio mensagem="Nenhuma hora registrada no período. A ocupação aparece conforme as OS entram em execução." />
      ) : (
        <ul className="space-y-3">
          {centros.map((centro) => {
            const largura = limitar(centro.ocupacaoPct, 0, 100);
            const abaixoDoAlvo = centro.ocupacaoPct < alvoOcupacao;

            return (
              <li key={centro.centroId}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate text-muted-foreground">{centro.nome}</span>
                        <span className="shrink-0 tabular-nums">
                          <span className="font-medium">
                            {formatarPercentual(centro.ocupacaoPct, 0)}
                          </span>
                          <span className="ml-1.5 text-muted-foreground">
                            {formatarHoras(centro.horasRealizadas)}
                          </span>
                        </span>
                      </div>

                      <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.07]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${largura}%`, backgroundColor: corDa(centro.ocupacaoPct) }}
                        />
                        {/* Marca do alvo, com anel de 2px para não se fundir à barra */}
                        <span
                          className="absolute top-0 h-full w-0.5 rounded-full"
                          style={{
                            left: `${limitar(alvoOcupacao, 0, 100)}%`,
                            backgroundColor: abaixoDoAlvo ? CORES_ESTADO.neutro : '#FFFFFF',
                            boxShadow: '0 0 0 2px #111827',
                          }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="space-y-0.5">
                      <p className="font-medium">{centro.nome}</p>
                      <p>
                        {formatarHoras(centro.horasRealizadas)} de{' '}
                        {formatarHoras(centro.horasDisponiveis)} disponíveis
                      </p>
                      <p>Receita atribuída: {formatarMoeda(centro.receitaGerada)}</p>
                      <p className="text-muted-foreground">
                        Alvo de ocupação: {formatarPercentual(alvoOcupacao, 0)}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
    </MolduraGrafico>
  );
}
