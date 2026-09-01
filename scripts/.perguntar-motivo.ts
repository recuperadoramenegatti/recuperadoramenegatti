/**
 * Imprime o motivo que estado-banco.ts dá para o ambiente atual.
 * Existe só para scripts/smoke-diagnostico.ts poder perguntar isso a um
 * processo separado — o cliente do Prisma lê a URL ao carregar, então mudar
 * process.env dentro do mesmo processo não teria efeito.
 */
import { estadoDoBanco } from '@/lib/estado-banco';

estadoDoBanco()
  .then((e) => {
    console.log(`MOTIVO=${e.pronto ? 'pronto' : e.motivo}`);
    process.exit(0);
  })
  .catch((e: unknown) => {
    console.log(`MOTIVO=excecao:${String(e).slice(0, 120)}`);
    process.exit(0);
  });
