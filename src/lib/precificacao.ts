/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  MATEMÁTICA PURA DA PRECIFICAÇÃO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este módulo contém apenas funções puras: recebem o contexto de cálculo
 * pronto e não tocam o banco. É o que permite a tela de orçamento recalcular
 * o preço a cada tecla, no navegador, sem uma ida ao servidor — e é a mesma
 * função que o servidor executa ao salvar, então cliente e banco nunca
 * discordam sobre o preço.
 *
 * `src/lib/calculos.ts` reexporta tudo daqui: quem estiver no servidor
 * continua importando de um lugar só.
 *
 * ── Nota sobre o CFR (evitando dupla contagem) ─────────────────────────────
 * A fórmula mestre do documento de calibração é:
 *     CUSTO_OS = SETUP + Σ(Tempo_i × Custo_hora_i) + INSUMOS + CFR_HORAS
 * Como o `Custo_hora_i` de cada centro JÁ é (THH + THM_i + CFR), somar um
 * "CFR_HORAS" adicional contaria o overhead duas vezes. A leitura correta é:
 * o CFR incide sobre TODAS as horas da OS, inclusive as de setup — que não
 * pertencem a nenhum centro. Portanto:
 *     custo hora de setup   = THH + CFR          (sem máquina associada)
 *     custo hora do centro  = THH + THM_i + CFR
 * O overhead é assim cobrado exatamente uma vez por hora trabalhada.
 */

import { arredondar, dividir, limitar, numero } from '@/lib/utils';
import type {
  BreakEvenResult,
  ClassificacaoMargem,
  ComparativoPecaNova,
  ContextoCalculo,
  CustoDetalhado,
  EntradaCalculoOS,
  LinhaCustoCentro,
  NCGResult,
  ParametrosBase,
  ParametrosDerivados,
  ResultadoPrecificacao,
  StatusComparativo,
} from '@/types';

// ═══════════════════════════════════════════════════════════════════════════
//  2. TAXAS DERIVADAS — THH, CFR, custo/hora por centro
// ═══════════════════════════════════════════════════════════════════════════

/**
 * THH — Taxa Hora-Homem.
 *   (folha bruta × multiplicador de encargos) ÷ nº operadores ÷ horas produtivas
 *
 * Calibração: (170.000 × 1,87) ÷ 14 ÷ 147,8 = R$ 153,59/h
 */
export function calcularTHH(p: ParametrosBase): number {
  const folhaComEncargos = p.folhaBrutaMensal * p.multiplicadorEncargos;
  const horasProdutivas = calcularHorasProdutivasPorOperador(p);
  return dividir(folhaComEncargos, p.qtdOperadores * horasProdutivas);
}

/** Horas disponíveis por operador no mês: jornada × dias úteis. */
export function calcularHorasDisponiveisPorOperador(p: ParametrosBase): number {
  return p.horasPorDia * p.diasUteisMes;
}

/** Horas efetivamente produtivas por operador, descontada a ociosidade. */
export function calcularHorasProdutivasPorOperador(p: ParametrosBase): number {
  const disponiveis = calcularHorasDisponiveisPorOperador(p);
  const fatorOcupacao = 1 - limitar(p.ociosidadePct, 0, 99) / 100;
  return disponiveis * fatorOcupacao;
}

/** Capacidade produtiva total da fábrica em horas/mês. */
export function calcularTotalHorasProdutivas(p: ParametrosBase): number {
  return calcularHorasProdutivasPorOperador(p) * p.qtdOperadores;
}

/**
 * CFR — Custo Fixo Rateado (overhead indireto por hora produtiva).
 *   (despesas administrativas + energia + manutenção) ÷ total de horas produtivas
 *
 * Calibração: 50.600 ÷ 2.070 = R$ 24,45/h
 */
export function calcularCFR(p: ParametrosBase): number {
  const overhead = calcularOverheadIndireto(p);
  return dividir(overhead, calcularTotalHorasProdutivas(p));
}

/** Base do rateio do CFR. Não inclui a folha produtiva (que está na THH). */
export function calcularOverheadIndireto(p: ParametrosBase): number {
  return p.despesasAdministrativas + p.energiaEletrica + p.manutencaoPreventiva;
}

/**
 * Custo fixo total mensal usado no ponto de equilíbrio e no DRE.
 * Inclui a folha produtiva com encargos — que é fixa no curto prazo — mais
 * o overhead indireto e as demais despesas fixas cadastradas.
 */
export function calcularCustosFixosMensais(p: ParametrosBase): number {
  return (
    p.folhaBrutaMensal * p.multiplicadorEncargos +
    calcularOverheadIndireto(p) +
    p.depreciacaoMensal +
    p.salariosAdministrativos +
    p.prolabore +
    p.aluguel +
    p.outrasDespesasFixas
  );
}

/** Todos os derivados de uma vez. */
export function calcularDerivados(p: ParametrosBase): ParametrosDerivados {
  const thh = calcularTHH(p);
  const cfr = calcularCFR(p);
  return {
    folhaComEncargos: p.folhaBrutaMensal * p.multiplicadorEncargos,
    horasDisponiveisPorOperador: calcularHorasDisponiveisPorOperador(p),
    horasProdutivasPorOperador: calcularHorasProdutivasPorOperador(p),
    totalHorasProdutivas: calcularTotalHorasProdutivas(p),
    totalHorasDisponiveis: calcularHorasDisponiveisPorOperador(p) * p.qtdOperadores,
    thh,
    overheadIndiretoMensal: calcularOverheadIndireto(p),
    cfr,
    custoHoraSetup: thh + cfr,
    custosFixosTotaisMensais: calcularCustosFixosMensais(p),
  };
}

/** Custo total por hora de um centro: THH + THM do centro + CFR. */
export function calcularCustoHoraCentro(thmCentro: number, p: ParametrosBase): number {
  return calcularTHH(p) + thmCentro + calcularCFR(p);
}

// ═══════════════════════════════════════════════════════════════════════════
//  3. CUSTO DE UMA OS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decompõe o custo de uma OS em mão de obra, máquina, overhead e insumos.
 * Função pura — roda igual no servidor e no navegador.
 */
export function calcularCustoOS(entrada: EntradaCalculoOS, ctx: ContextoCalculo): CustoDetalhado {
  const { derivados, centros } = ctx;
  const porId = new Map(centros.map((c) => [c.id, c]));

  const linhasCentro: LinhaCustoCentro[] = [];
  let horasProducao = 0;

  for (const tempo of entrada.tempos) {
    const centro = porId.get(tempo.centroId);
    if (!centro) continue;
    const horas = Math.max(0, numero(tempo.horas));
    if (horas <= 0) continue;

    horasProducao += horas;
    linhasCentro.push({
      centroId: centro.id,
      nome: centro.nome,
      horas,
      custoHora: centro.custoHora,
      thh: centro.thh,
      thm: centro.thm,
      cfr: centro.cfr,
      custo: arredondar(horas * centro.custoHora),
    });
  }

  const horasSetup = Math.max(0, numero(entrada.horasSetup));
  const horasTotais = horasProducao + horasSetup;

  // Setup consome mão de obra e overhead, mas nenhuma máquina específica.
  const custoSetup = arredondar(horasSetup * derivados.custoHoraSetup);

  // Decomposição por natureza (a soma bate exatamente com o custo das linhas).
  const custoMaoDeObra = arredondar(horasTotais * derivados.thh);
  const custoMaquina = arredondar(
    linhasCentro.reduce((acc, l) => acc + l.horas * l.thm, 0),
  );
  const custoOverhead = arredondar(horasTotais * derivados.cfr);

  // Insumos
  const custoMateriaisBase = Math.max(0, numero(entrada.custoMateriais));
  const markup = Math.max(0, numero(entrada.markupMateriais));
  const valorMarkupMateriais = arredondar(custoMateriaisBase * (markup / 100));
  const custoConsumiveis = Math.max(0, numero(entrada.custoConsumiveis));
  const custoFerramentas = Math.max(0, numero(entrada.custoFerramentas));
  const custoExtras = arredondar(
    entrada.insumosExtras.reduce((acc, i) => acc + Math.max(0, numero(i.valor)), 0),
  );

  const custoInsumosTotal = arredondar(
    custoMateriaisBase + valorMarkupMateriais + custoConsumiveis + custoFerramentas + custoExtras,
  );

  const custoMaoDeObraMaquina = arredondar(custoMaoDeObra + custoMaquina);
  const custoTotal = arredondar(custoMaoDeObraMaquina + custoOverhead + custoInsumosTotal);

  return {
    linhasCentro,
    custoSetup,
    custoMaoDeObra,
    custoMaquina,
    custoOverhead,
    custoMaoDeObraMaquina,
    custoMateriaisBase,
    valorMarkupMateriais,
    custoConsumiveis,
    custoFerramentas,
    custoExtras,
    custoInsumosTotal,
    custoTotal,
    horasProducao: arredondar(horasProducao, 2),
    horasSetup: arredondar(horasSetup, 2),
    horasTotais: arredondar(horasTotais, 2),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  4. PRECIFICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aplica a fórmula mestre:
 *   PRECO_MINIMO  = CUSTO ÷ (1 − margem)
 *   PRECO_CLIENTE = PRECO_MINIMO ÷ (1 − alíquota)
 *
 * Duas margens são devolvidas, e a diferença importa:
 *
 *   • `margemReal`         = (preço − custo) ÷ preço — a fórmula literal do
 *                            documento de calibração. É bruta: mede o lucro
 *                            contra o preço cheio, sem descontar impostos, e
 *                            por isso sempre parece maior do que é.
 *
 *   • `margemContribuicao` = (preço − custo − impostos) ÷ RECEITA LÍQUIDA —
 *                            o número com significado econômico, e o que
 *                            dirige o semáforo.
 *
 * A base da margem de contribuição é a receita líquida (preço menos
 * impostos), não o preço cheio. Não é detalhe: é o que faz o resultado
 * bater com a margem escolhida no slider e com a linha de margem de
 * contribuição do DRE.
 *
 * Conferindo com custo de R$ 1.000, margem de 30% e alíquota de 14,5%:
 *   preço mínimo   = 1.000 ÷ 0,70   = R$ 1.428,57
 *   preço cliente  = 1.428,57 ÷ 0,855 = R$ 1.670,84
 *   impostos       = 1.670,84 × 0,145 = R$   242,27
 *   receita líquida= 1.670,84 − 242,27 = R$ 1.428,57
 *   contribuição   = 1.428,57 − 1.000  = R$   428,57  →  30,0% ✓
 * Sobre o preço cheio o mesmo lucro daria 25,65% — a margem pedida
 * apareceria menor do que foi escolhida, e o semáforo acusaria "crítico"
 * uma OS perfeitamente saudável.
 */
export function calcularPrecoSugerido(
  custo: CustoDetalhado,
  margemDesejada: number,
  aliquota: number,
  p: ParametrosBase,
  precoFinalManual?: number | null,
  descontoMaximo = 0,
): Omit<ResultadoPrecificacao, 'comparativoPecaNova'> {
  const margem = limitar(numero(margemDesejada), 0, 95);
  const aliq = limitar(numero(aliquota), 0, 95);

  const precoMinimo = arredondar(dividir(custo.custoTotal, 1 - margem / 100, custo.custoTotal));
  const precoSugerido = arredondar(dividir(precoMinimo, 1 - aliq / 100, precoMinimo));

  const precoFinal =
    precoFinalManual !== null && precoFinalManual !== undefined && precoFinalManual > 0
      ? arredondar(precoFinalManual)
      : precoSugerido;

  const valorImpostos = arredondar(precoFinal * (aliq / 100));
  const lucroEstimado = arredondar(precoFinal - custo.custoTotal - valorImpostos);

  const receitaLiquida = precoFinal - valorImpostos;
  const margemReal = arredondar(dividir(precoFinal - custo.custoTotal, precoFinal) * 100, 2);
  const margemContribuicao = arredondar(dividir(lucroEstimado, receitaLiquida) * 100, 2);

  // Horas mínimas para que a receita cubra o custo total desta OS.
  const receitaPorHora = dividir(receitaLiquida, custo.horasTotais);
  const horasEquilibrio = arredondar(dividir(custo.custoTotal, receitaPorHora), 2);

  return {
    custo,
    margemDesejada: margem,
    aliquota: aliq,
    precoMinimo,
    precoSugerido,
    precoFinal,
    margemReal,
    margemContribuicao,
    valorImpostos,
    lucroEstimado,
    classificacao: classificarMargem(margemContribuicao, p),
    horasEquilibrio,
    precoComDescontoMaximo: arredondar(precoFinal * (1 - limitar(descontoMaximo, 0, 100) / 100)),
  };
}

/**
 * Semáforo de margem.
 *   🔴 abaixo da mínima  🟡 entre mínima e ideal  🟢 acima da ideal
 * Os limiares são configuráveis (default 15% / 30%). "Excelente" é reservado
 * para margens bem acima da ideal.
 */
export function classificarMargem(margem: number, p: ParametrosBase): ClassificacaoMargem {
  if (!Number.isFinite(margem) || margem < p.margemMinima) return 'critica';
  const meio = (p.margemMinima + p.margemIdeal) / 2;
  if (margem < meio) return 'baixa';
  if (margem < p.margemIdeal) return 'boa';
  return 'excelente';
}

/** Compara o preço da recuperação com o da peça nova de mercado. */
export function calcularComparativoPecaNova(
  precoRecuperacao: number,
  precoPecaNova: number | null | undefined,
  descontoTolerado: number,
  p: ParametrosBase,
): ComparativoPecaNova | null {
  if (!precoPecaNova || precoPecaNova <= 0) return null;

  const economiaCliente = arredondar(precoPecaNova - precoRecuperacao);
  const economiaPct = arredondar(dividir(economiaCliente, precoPecaNova) * 100, 1);
  const percentualDaPecaNova = arredondar(dividir(precoRecuperacao, precoPecaNova) * 100, 1);

  let status: StatusComparativo;
  let mensagem: string;

  if (percentualDaPecaNova >= 100) {
    status = 'inviavel';
    mensagem =
      'A recuperação custa o mesmo ou mais que a peça nova. Nenhum cliente aceita — ' +
      'recuse o serviço ou reveja radicalmente o escopo.';
  } else if (percentualDaPecaNova > p.limiarProximidadePecaNova) {
    status = 'proximo';
    mensagem =
      `A recuperação equivale a ${percentualDaPecaNova.toFixed(0)}% do valor da peça nova. ` +
      'Margem de persuasão estreita: o cliente tende a preferir o produto novo.';
  } else if (economiaPct >= descontoTolerado) {
    status = 'adequado';
    mensagem =
      `Economia de ${economiaPct.toFixed(0)}% para o cliente, acima do desconto-alvo de ` +
      `${descontoTolerado.toFixed(0)}%. Posicionamento competitivo e rentável.`;
  } else {
    status = 'proximo';
    mensagem =
      `Economia de ${economiaPct.toFixed(0)}% fica abaixo do desconto-alvo de ` +
      `${descontoTolerado.toFixed(0)}%. Avalie reduzir o preço ou reforçar o argumento de prazo.`;
  }

  return {
    precoPecaNova: arredondar(precoPecaNova),
    precoRecuperacao: arredondar(precoRecuperacao),
    economiaCliente,
    economiaPct,
    percentualDaPecaNova,
    descontoTolerado,
    status,
    mensagem,
  };
}

/**
 * Ponta a ponta: da entrada do formulário ao preço final, com comparativo.
 * É esta função que a tela de orçamento chama a cada keystroke (com debounce).
 */
export function precificarOS(
  entrada: EntradaCalculoOS,
  ctx: ContextoCalculo,
): ResultadoPrecificacao {
  const custo = calcularCustoOS(entrada, ctx);
  const base = calcularPrecoSugerido(
    custo,
    entrada.margemDesejada,
    ctx.parametros.aliquotaImpostos,
    ctx.parametros,
    entrada.precoFinal,
  );

  const comparativoPecaNova =
    entrada.tipo === 'recuperacao'
      ? calcularComparativoPecaNova(
          base.precoFinal,
          entrada.precoPecaNova,
          numero(entrada.descontoTolerado, ctx.parametros.descontoToleradoPecaNova),
          ctx.parametros,
        )
      : null;

  return { ...base, comparativoPecaNova };
}

// ═══════════════════════════════════════════════════════════════════════════
//  5. PONTO DE EQUILÍBRIO E CAPITAL DE GIRO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ponto de equilíbrio operacional (EBITDA = 0).
 *
 * ── Por que não é "custos fixos ÷ margem de contribuição" ──────────────────
 *
 * A fórmula de manual pressupõe que a mão de obra seja custo fixo e não
 * entre no custo do produto. Aqui ela entra: a THH carrega a folha inteira
 * dentro do preço de cada OS. Dividir os custos fixos (que incluem a folha)
 * por uma margem já líquida de mão de obra contaria a folha duas vezes e
 * jogaria o ponto de equilíbrio para quase o quádruplo do real.
 *
 * O modelo correto é o que fecha com o DRE deste sistema. Igualando o EBITDA
 * a zero:
 *
 *   receita líquida − insumos − MO absorvida − MO ociosa − custos fixos = 0
 *
 * e como (MO absorvida + MO ociosa) é sempre a folha inteira, uma constante:
 *
 *   receita líquida − insumos = folha + overhead + demais despesas fixas
 *
 * Logo o único custo verdadeiramente variável no denominador é o de insumos:
 *
 *   PE (receita líquida) = custos fixos ÷ margem sobre custos variáveis
 *
 * A folha aparece uma única vez, do lado dos custos fixos — que é onde ela
 * de fato está no curto prazo. O resultado é convertido para faturamento
 * bruto no fim, porque é em nota emitida que o gestor pensa.
 */
export function calcularBreakEven(
  p: ParametrosBase,
  /**
   * Percentual da receita líquida que sobra depois APENAS dos custos
   * variáveis (materiais, consumíveis, ferramentas). Não desconte mão de
   * obra: ela é fixa neste modelo. Sem histórico, passe 0 para usar o
   * cenário sem insumos.
   */
  margemVariavelPct: number,
  faturamentoAtual: number,
): BreakEvenResult {
  const custosFixos = calcularCustosFixosMensais(p) - p.depreciacaoMensal;

  // Sem histórico, assume ausência de insumos: é o piso do ponto de
  // equilíbrio, e qualquer material só o empurra para cima.
  const margem = margemVariavelPct > 0 ? limitar(margemVariavelPct, 1, 100) : 100;

  const equilibrioLiquido = dividir(custosFixos, margem / 100, custosFixos);
  const aliquota = limitar(p.aliquotaImpostos, 0, 95) / 100;
  const pontoEquilibrioReceita = arredondar(
    dividir(equilibrioLiquido, 1 - aliquota, equilibrioLiquido),
  );

  const totalHoras = calcularTotalHorasProdutivas(p);
  const receitaPorHora = dividir(
    faturamentoAtual > 0 ? faturamentoAtual : p.metaFaturamentoMensal,
    totalHoras,
  );
  const pontoEquilibrioHoras = arredondar(dividir(pontoEquilibrioReceita, receitaPorHora), 1);

  const indiceCobertura = arredondar(dividir(faturamentoAtual, pontoEquilibrioReceita), 2);
  const margemSeguranca = arredondar(
    dividir(faturamentoAtual - pontoEquilibrioReceita, faturamentoAtual) * 100,
    1,
  );

  const status: BreakEvenResult['status'] =
    indiceCobertura >= 1.1 ? 'coberto' : indiceCobertura >= 1 ? 'em_risco' : 'nao_coberto';

  return {
    custosFixosMensais: arredondar(custosFixos),
    margemVariavelPct: arredondar(margem, 1),
    pontoEquilibrioReceita,
    pontoEquilibrioHoras,
    faturamentoAtual: arredondar(faturamentoAtual),
    indiceCobertura,
    margemSeguranca,
    status,
  };
}

/**
 * NCG — Necessidade de Capital de Giro.
 *   NCG = (PMR − PMP) × faturamento diário médio
 */
export function calcularNCG(
  pmr: number,
  pmp: number,
  faturamentoDiarioMedio: number,
  saldoCaixa = 0,
  saidaDiariaMedia = 0,
): NCGResult {
  const cicloFinanceiro = pmr - pmp;
  const ncg = arredondar(cicloFinanceiro * faturamentoDiarioMedio);
  return {
    pmr,
    pmp,
    faturamentoDiarioMedio: arredondar(faturamentoDiarioMedio),
    ncg,
    cicloFinanceiro,
    diasDeCaixa: arredondar(dividir(saldoCaixa, saidaDiariaMedia), 1),
  };
}

