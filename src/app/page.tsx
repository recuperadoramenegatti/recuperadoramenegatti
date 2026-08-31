import { redirect } from 'next/navigation';
import { estadoDoBanco } from '@/lib/estado-banco';

/**
 * Porta de entrada.
 *
 * Antes de mandar para o dashboard, confere se há banco de dados. Sem essa
 * checagem, um sistema publicado sem banco recebia o usuário com um erro
 * técnico; agora recebe com a tela que explica o que falta configurar.
 */
export const dynamic = 'force-dynamic';

export default async function Home(): Promise<never> {
  const estado = await estadoDoBanco();
  redirect(estado.pronto ? '/dashboard' : '/configurar');
}
