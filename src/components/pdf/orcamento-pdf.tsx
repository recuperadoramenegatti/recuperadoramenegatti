/**
 * Documento PDF do orçamento — @react-pdf/renderer.
 *
 * Renderizado no servidor (rota /api/ordens/pdf), nunca no cliente: o
 * renderer é pesado e não precisa ir para o bundle do navegador.
 *
 * O PDF é o que chega ao cliente da Menegatti, então mostra preço, prazo e
 * a economia frente à peça nova — e nunca a decomposição interna de custo,
 * margem ou taxas horárias.
 */

import * as React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { formatarData, formatarHoras, formatarMoeda, formatarPercentual } from '@/lib/formatacao';
import type { ComparativoPecaNova, TipoOS } from '@/types';
import { LABEL_TIPO_OS } from '@/types';

export interface DadosEmpresaPDF {
  nome: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  email: string;
  logo: string;
  setor: string;
}

export interface DadosOrcamentoPDF {
  numero: string;
  tipo: TipoOS;
  descricao: string;
  clienteNome: string;
  clienteDocumento: string | null;
  clienteCidade: string | null;
  clienteTelefone: string | null;
  dataOrcamento: string;
  dataPrevisaoEntrega: string | null;
  validadeDias: number;
  horasTotais: number;
  precoFinal: number;
  descontoMaximo: number;
  precoComDesconto: number;
  observacoesCliente: string | null;
  comparativo: ComparativoPecaNova | null;
  itens: Array<{ nome: string; horas: number }>;
}

const AMBAR = '#B45309';
const AMBAR_CLARO = '#FEF3C7';
const GRAFITE = '#111827';
const CINZA = '#6B7280';
const CINZA_CLARO = '#F3F4F6';
const BORDA = '#E5E7EB';
const VERDE = '#047857';

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 36,
    paddingBottom: 64,
    paddingHorizontal: 40,
    fontSize: 9.5,
    color: GRAFITE,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
  },

  // Cabeçalho
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: AMBAR,
    paddingBottom: 12,
    marginBottom: 18,
  },
  blocoEmpresa: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '62%' },
  logo: { width: 42, height: 42, objectFit: 'contain' },
  nomeEmpresa: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: GRAFITE },
  setorEmpresa: { fontSize: 7.5, color: CINZA, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.6 },
  contatoEmpresa: { fontSize: 7.5, color: CINZA, marginTop: 3 },

  blocoNumero: { alignItems: 'flex-end' },
  rotuloOrcamento: { fontSize: 7.5, color: CINZA, textTransform: 'uppercase', letterSpacing: 1 },
  numeroOS: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: AMBAR, marginTop: 1 },
  dataEmissao: { fontSize: 7.5, color: CINZA, marginTop: 3 },

  // Seções
  secao: { marginBottom: 14 },
  tituloSecao: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: CINZA,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  caixa: {
    borderWidth: 1,
    borderColor: BORDA,
    borderRadius: 4,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  caixaCinza: {
    borderWidth: 1,
    borderColor: BORDA,
    borderRadius: 4,
    padding: 10,
    backgroundColor: CINZA_CLARO,
  },

  linhaDupla: { flexDirection: 'row', gap: 16 },
  colunaMeia: { flex: 1 },
  campo: { marginBottom: 4 },
  rotulo: { fontSize: 7.5, color: CINZA, textTransform: 'uppercase', letterSpacing: 0.4 },
  valor: { fontSize: 10 },
  valorForte: { fontSize: 10, fontFamily: 'Helvetica-Bold' },

  // Tabela de etapas
  tabelaCabecalho: {
    flexDirection: 'row',
    backgroundColor: CINZA_CLARO,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tabelaLinha: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDA,
  },
  celulaEtapa: { flex: 1, fontSize: 9 },
  celulaHoras: { width: 70, textAlign: 'right', fontSize: 9 },
  celulaCabecalho: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: CINZA, textTransform: 'uppercase' },

  // Preço
  caixaPreco: {
    borderWidth: 1.5,
    borderColor: AMBAR,
    borderRadius: 6,
    backgroundColor: AMBAR_CLARO,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rotuloPreco: { fontSize: 8, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.8 },
  precoGrande: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: AMBAR, marginTop: 2 },
  prazoLateral: { alignItems: 'flex-end' },

  // Comparativo
  caixaEconomia: {
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 4,
    backgroundColor: '#ECFDF5',
    padding: 10,
    marginTop: 10,
  },
  tituloEconomia: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: VERDE, marginBottom: 5 },
  linhaEconomia: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  textoEconomia: { fontSize: 9, color: '#065F46' },
  destaqueEconomia: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: VERDE },

  // Condições
  itemCondicao: { flexDirection: 'row', gap: 5, marginBottom: 2.5 },
  marcador: { fontSize: 9, color: AMBAR },
  textoCondicao: { flex: 1, fontSize: 8.5, color: '#374151' },

  // Rodapé
  rodape: {
    position: 'absolute',
    bottom: 26,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BORDA,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  textoRodape: { fontSize: 7, color: CINZA },

  assinaturas: { flexDirection: 'row', gap: 40, marginTop: 26 },
  linhaAssinatura: { flex: 1, borderTopWidth: 1, borderTopColor: '#9CA3AF', paddingTop: 4 },
  rotuloAssinatura: { fontSize: 7.5, color: CINZA, textAlign: 'center' },
});

export function OrcamentoPDF({
  empresa,
  orcamento,
}: {
  empresa: DadosEmpresaPDF;
  orcamento: DadosOrcamentoPDF;
}): React.JSX.Element {
  const contato = [empresa.telefone, empresa.email].filter(Boolean).join('  ·  ');
  const validade = new Date(orcamento.dataOrcamento);
  validade.setDate(validade.getDate() + orcamento.validadeDias);

  return (
    <Document
      title={`Orçamento ${orcamento.numero} — ${empresa.nome}`}
      author={empresa.nome}
      subject={orcamento.descricao}
    >
      <Page size="A4" style={estilos.pagina}>
        {/* ── Cabeçalho ────────────────────────────────────────────── */}
        <View style={estilos.cabecalho} fixed>
          <View style={estilos.blocoEmpresa}>
            {empresa.logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- Image do @react-pdf/renderer não é <img> do DOM e não aceita alt
              <Image src={empresa.logo} style={estilos.logo} />
            ) : null}
            <View>
              <Text style={estilos.nomeEmpresa}>{empresa.nome}</Text>
              {empresa.setor ? <Text style={estilos.setorEmpresa}>{empresa.setor}</Text> : null}
              {empresa.cnpj ? (
                <Text style={estilos.contatoEmpresa}>CNPJ {empresa.cnpj}</Text>
              ) : null}
              {empresa.endereco ? (
                <Text style={estilos.contatoEmpresa}>{empresa.endereco}</Text>
              ) : null}
              {contato ? <Text style={estilos.contatoEmpresa}>{contato}</Text> : null}
            </View>
          </View>

          <View style={estilos.blocoNumero}>
            <Text style={estilos.rotuloOrcamento}>Orçamento</Text>
            <Text style={estilos.numeroOS}>{orcamento.numero}</Text>
            <Text style={estilos.dataEmissao}>
              Emitido em {formatarData(orcamento.dataOrcamento)}
            </Text>
          </View>
        </View>

        {/* ── Cliente ──────────────────────────────────────────────── */}
        <View style={estilos.secao}>
          <Text style={estilos.tituloSecao}>Cliente</Text>
          <View style={estilos.caixa}>
            <View style={estilos.linhaDupla}>
              <View style={estilos.colunaMeia}>
                <View style={estilos.campo}>
                  <Text style={estilos.rotulo}>Nome / Razão social</Text>
                  <Text style={estilos.valorForte}>{orcamento.clienteNome}</Text>
                </View>
                {orcamento.clienteDocumento ? (
                  <View style={estilos.campo}>
                    <Text style={estilos.rotulo}>CNPJ / CPF</Text>
                    <Text style={estilos.valor}>{orcamento.clienteDocumento}</Text>
                  </View>
                ) : null}
              </View>
              <View style={estilos.colunaMeia}>
                {orcamento.clienteCidade ? (
                  <View style={estilos.campo}>
                    <Text style={estilos.rotulo}>Cidade</Text>
                    <Text style={estilos.valor}>{orcamento.clienteCidade}</Text>
                  </View>
                ) : null}
                {orcamento.clienteTelefone ? (
                  <View style={estilos.campo}>
                    <Text style={estilos.rotulo}>Telefone</Text>
                    <Text style={estilos.valor}>{orcamento.clienteTelefone}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* ── Serviço ──────────────────────────────────────────────── */}
        <View style={estilos.secao}>
          <Text style={estilos.tituloSecao}>Serviço proposto</Text>
          <View style={estilos.caixa}>
            <View style={estilos.campo}>
              <Text style={estilos.rotulo}>Natureza do serviço</Text>
              <Text style={estilos.valorForte}>{LABEL_TIPO_OS[orcamento.tipo]}</Text>
            </View>
            <View style={estilos.campo}>
              <Text style={estilos.rotulo}>Descrição</Text>
              <Text style={estilos.valor}>{orcamento.descricao}</Text>
            </View>
          </View>
        </View>

        {/* ── Etapas de execução ───────────────────────────────────── */}
        {orcamento.itens.length > 0 ? (
          <View style={estilos.secao}>
            <Text style={estilos.tituloSecao}>Etapas de execução</Text>
            <View style={{ borderWidth: 1, borderColor: BORDA, borderRadius: 4 }}>
              <View style={estilos.tabelaCabecalho}>
                <Text style={[estilos.celulaEtapa, estilos.celulaCabecalho]}>Etapa</Text>
                <Text style={[estilos.celulaHoras, estilos.celulaCabecalho]}>Horas</Text>
              </View>
              {orcamento.itens.map((item, indice) => (
                <View
                  key={`${item.nome}-${indice}`}
                  style={[
                    estilos.tabelaLinha,
                    indice === orcamento.itens.length - 1 ? { borderBottomWidth: 0 } : {},
                  ]}
                >
                  <Text style={estilos.celulaEtapa}>{item.nome}</Text>
                  <Text style={estilos.celulaHoras}>{formatarHoras(item.horas)}</Text>
                </View>
              ))}
              <View style={[estilos.tabelaLinha, { backgroundColor: CINZA_CLARO, borderBottomWidth: 0 }]}>
                <Text style={[estilos.celulaEtapa, { fontFamily: 'Helvetica-Bold' }]}>
                  Total de mão de obra
                </Text>
                <Text style={[estilos.celulaHoras, { fontFamily: 'Helvetica-Bold' }]}>
                  {formatarHoras(orcamento.horasTotais)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Preço ────────────────────────────────────────────────── */}
        <View style={estilos.secao}>
          <Text style={estilos.tituloSecao}>Investimento</Text>
          <View style={estilos.caixaPreco}>
            <View>
              <Text style={estilos.rotuloPreco}>Valor total do serviço</Text>
              <Text style={estilos.precoGrande}>{formatarMoeda(orcamento.precoFinal)}</Text>
            </View>
            <View style={estilos.prazoLateral}>
              {orcamento.dataPrevisaoEntrega ? (
                <>
                  <Text style={estilos.rotulo}>Previsão de entrega</Text>
                  <Text style={estilos.valorForte}>
                    {formatarData(orcamento.dataPrevisaoEntrega)}
                  </Text>
                </>
              ) : null}
              <Text style={[estilos.rotulo, { marginTop: 6 }]}>Válido até</Text>
              <Text style={estilos.valorForte}>{formatarData(validade)}</Text>
            </View>
          </View>

          {/* Economia frente à peça nova */}
          {orcamento.comparativo && orcamento.comparativo.economiaCliente > 0 ? (
            <View style={estilos.caixaEconomia}>
              <Text style={estilos.tituloEconomia}>
                Comparativo com a peça nova de mercado
              </Text>
              <View style={estilos.linhaEconomia}>
                <Text style={estilos.textoEconomia}>Peça nova</Text>
                <Text style={estilos.textoEconomia}>
                  {formatarMoeda(orcamento.comparativo.precoPecaNova)}
                </Text>
              </View>
              <View style={estilos.linhaEconomia}>
                <Text style={estilos.textoEconomia}>Recuperação Menegatti</Text>
                <Text style={estilos.textoEconomia}>
                  {formatarMoeda(orcamento.comparativo.precoRecuperacao)}
                </Text>
              </View>
              <View
                style={[
                  estilos.linhaEconomia,
                  { borderTopWidth: 1, borderTopColor: '#A7F3D0', paddingTop: 4, marginTop: 3 },
                ]}
              >
                <Text style={estilos.destaqueEconomia}>Sua economia</Text>
                <Text style={estilos.destaqueEconomia}>
                  {formatarMoeda(orcamento.comparativo.economiaCliente)} (
                  {formatarPercentual(orcamento.comparativo.economiaPct, 0)})
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Condições ────────────────────────────────────────────── */}
        <View style={estilos.secao}>
          <Text style={estilos.tituloSecao}>Condições comerciais</Text>
          <View style={estilos.caixaCinza}>
            {[
              `Proposta válida por ${orcamento.validadeDias} dias a contar da data de emissão.`,
              'Valores já incluem os tributos aplicáveis ao regime do Simples Nacional.',
              'O prazo de entrega começa a contar da aprovação formal e da entrega da peça na oficina.',
              'Serviços adicionais identificados durante a execução serão orçados à parte, com aprovação prévia.',
              orcamento.observacoesCliente ?? '',
            ]
              .filter(Boolean)
              .map((condicao, indice) => (
                <View key={indice} style={estilos.itemCondicao}>
                  <Text style={estilos.marcador}>•</Text>
                  <Text style={estilos.textoCondicao}>{condicao}</Text>
                </View>
              ))}
          </View>
        </View>

        {/* ── Assinaturas ──────────────────────────────────────────── */}
        <View style={estilos.assinaturas}>
          <View style={estilos.linhaAssinatura}>
            <Text style={estilos.rotuloAssinatura}>{empresa.nome}</Text>
          </View>
          <View style={estilos.linhaAssinatura}>
            <Text style={estilos.rotuloAssinatura}>
              {orcamento.clienteNome} — aprovação do cliente
            </Text>
          </View>
        </View>

        {/* ── Rodapé ───────────────────────────────────────────────── */}
        <View style={estilos.rodape} fixed>
          <Text style={estilos.textoRodape}>
            {empresa.nome}
            {contato ? `  ·  ${contato}` : ''}
          </Text>
          <Text
            style={estilos.textoRodape}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
