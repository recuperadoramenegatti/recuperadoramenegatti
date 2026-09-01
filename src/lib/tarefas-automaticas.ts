/**
 * Tarefas automáticas de manutenção.
 *
 * O sistema roda na máquina da empresa, sem agendador externo — não há cron,
 * nem serviço de fundo, nem garantia de que o computador fique ligado. O
 * gatilho possível é o próprio uso: toda tela autenticada passa pelo layout
 * do dashboard, que chama `executarTarefasAutomaticas`.
 *
 * Três regras tornam isso seguro:
 *
 *  1. Nunca bloqueia a renderização. É disparado sem `await`; a página não
 *     espera por backup nenhum.
 *  2. Nunca lança. Uma falha de manutenção não pode derrubar a tela que o
 *     usuário pediu.
 *  3. No máximo uma verificação por hora por processo, com trava em memória
 *     para que navegações simultâneas não disparem o mesmo trabalho duas
 *     vezes.
 *
 * Na Vercel esse "processo" é uma função serverless: não há garantia de que
 * o trabalho disparado sem `await` termine antes de a função ser encerrada
 * após a resposta, e não há disco persistente para o backup semanal gravar.
 * Por isso lá o backup automático é pulado — o botão de exportação manual
 * (`/api/backup/exportar`) permanece o caminho de backup, rodando dentro do
 * próprio ciclo de requisição/resposta. A verificação de insight mensal, que
 * só lê e grava no banco, continua rodando em qualquer ambiente.
 */

import { verificarBackupSemanal } from '@/lib/backup';
import { verificarInsightAutomatico } from '@/lib/ia';
import { extrairMensagemErro } from '@/lib/utils';

const INTERVALO_VERIFICACAO = 60 * 60 * 1000; // 1 hora
const RODANDO_NA_VERCEL = process.env.VERCEL === '1';

interface EstadoTarefas {
  ultimaVerificacao: number;
  emAndamento: boolean;
}

// Estado no escopo global: em desenvolvimento o Next recarrega os módulos a
// cada alteração, e um estado local reiniciaria o contador a toda edição.
const globalParaTarefas = globalThis as unknown as { __tarefasMenegatti?: EstadoTarefas };

const estado: EstadoTarefas = (globalParaTarefas.__tarefasMenegatti ??= {
  ultimaVerificacao: 0,
  emAndamento: false,
});

/**
 * Dispara as tarefas de manutenção se já passou o intervalo.
 * Retorna imediatamente; o trabalho acontece em segundo plano.
 */
export function executarTarefasAutomaticas(): void {
  const agora = Date.now();

  if (estado.emAndamento) return;
  if (agora - estado.ultimaVerificacao < INTERVALO_VERIFICACAO) return;

  estado.ultimaVerificacao = agora;
  estado.emAndamento = true;

  void (async () => {
    try {
      if (!RODANDO_NA_VERCEL) await verificarBackupSemanal();
      await verificarInsightAutomatico();
    } catch (erro) {
      console.error('[tarefas] Falha na manutenção automática:', extrairMensagemErro(erro));
    } finally {
      estado.emAndamento = false;
    }
  })();
}
