import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { comSessao, erro, lerJson, ok } from '@/lib/api';
import { schemaAlterarSenha } from '@/lib/validacoes';
import { marcarSenhaComoDoDono } from '@/lib/senha-definida';

export const dynamic = 'force-dynamic';

/** PUT — troca a senha do usuário autenticado. */
export async function PUT(request: Request): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const corpo = await lerJson(request);
    const dados = schemaAlterarSenha.parse(corpo);

    const registro = await prisma.user.findUnique({ where: { email: usuario.email } });
    if (!registro) return erro('Usuário não encontrado.', 404);

    const confere = await bcrypt.compare(dados.senhaAtual, registro.password);
    if (!confere) return erro('A senha atual está incorreta.', 403);

    const hash = await bcrypt.hash(dados.novaSenha, 12);
    await prisma.user.update({ where: { id: registro.id }, data: { password: hash } });

    // A partir daqui a senha é do dono: nenhuma publicação futura a desfaz.
    await marcarSenhaComoDoDono();

    await prisma.logAlteracao.create({
      data: {
        entidade: 'configuracao',
        entidadeId: registro.id,
        acao: 'atualizacao',
        descricao: 'Senha de acesso alterada.',
        usuario: usuario.email,
      },
    });

    return ok({ alterada: true });
  });
}
