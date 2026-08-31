import { NextResponse, type NextRequest } from 'next/server';

/**
 * Guarda de rotas.
 *
 * Faz apenas a checagem barata do cookie de sessão — a validação real do JWT
 * acontece no `auth()` de cada layout e rota de API. Isso mantém o middleware
 * no runtime Edge sem arrastar Prisma nem bcrypt para dentro dele.
 */
/**
 * `/configurar` é pública de propósito: ela existe justamente para quando o
 * banco ainda não foi conectado, e nesse estado não há como validar login
 * nenhum. Ela não mostra dado algum da empresa — só o que falta configurar.
 */
const ROTAS_PUBLICAS = ['/login', '/configurar'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const temSessao =
    request.cookies.has('authjs.session-token') ||
    request.cookies.has('__Secure-authjs.session-token');

  const ehPublica = ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota));

  if (!temSessao && !ehPublica) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('destino', pathname);
    return NextResponse.redirect(url);
  }

  // Quem já entrou não precisa ver a tela de login de novo — mas `/configurar`
  // fica de fora: mandar um usuário logado de volta ao dashboard quando é
  // justamente o banco que está fora do ar criaria um ping-pong de redirects.
  if (temSessao && ehPublica && !pathname.startsWith('/configurar')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Tudo, exceto:
     *  - qualquer rota de API (elas validam a sessão com `exigirSessao()`,
     *    devolvendo 401 em JSON em vez de um redirect em HTML)
     *  - assets estáticos do Next
     *  - arquivos públicos (logo, favicon…)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
