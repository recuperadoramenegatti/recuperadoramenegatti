/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  "A SENHA É DO DONO A PARTIR DE AGORA"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Uma marca no banco que responde uma pergunta só: a senha guardada foi
 * escolhida pelo dono, ou ainda é a que o instalador colocou?
 *
 * Ela resolve um conflito real entre duas coisas que ambas parecem certas:
 *
 *   "o seed nunca deve desfazer a senha do dono"  — óbvio, e verdadeiro.
 *   "publicar de novo deve devolver o acesso"     — também verdadeiro, quando
 *                                                   o acesso se perdeu.
 *
 * Sem distinguir os dois casos, escolher qualquer um dos lados machuca: ou o
 * dono perde a senha que definiu, ou fica trancado do lado de fora para
 * sempre. Foi o segundo que aconteceu aqui — dias sem conseguir entrar, sem
 * saída que não fosse editar o banco à mão.
 *
 * Com a marca, os dois convivem: enquanto ninguém trocou a senha pela tela do
 * sistema, cada publicação realinha o acesso com o configurado (não há nada
 * do dono ali para perder). Assim que ele troca a senha, a marca aparece e o
 * seed nunca mais encosta nela.
 */
import { prisma } from '@/lib/prisma';

export const CHAVE_SENHA_DEFINIDA = 'senhaDefinidaPeloDono';

/**
 * Registra que a senha atual foi escolhida pelo dono.
 *
 * Chamado pela troca de senha e pela recuperação — os dois caminhos em que
 * uma pessoa decide conscientemente qual é a senha.
 *
 * Nunca lança: falhar em anotar a marca não pode impedir a troca de senha em
 * si. O custo de não anotar é o seed realinhar o acesso na próxima
 * publicação, o que é recuperável; o custo de derrubar a troca de senha por
 * causa disso não seria.
 */
export async function marcarSenhaComoDoDono(): Promise<void> {
  try {
    await prisma.configuracao.upsert({
      where: { chave: CHAVE_SENHA_DEFINIDA },
      update: { valor: 'true' },
      create: {
        chave: CHAVE_SENHA_DEFINIDA,
        valor: 'true',
        tipo: 'boolean',
        grupo: 'empresa',
        descricao: 'A senha de acesso foi definida pelo dono, não pelo instalador',
      },
    });
  } catch {
    /* ver comentário acima */
  }
}
