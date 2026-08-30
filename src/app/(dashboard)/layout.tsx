import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { getConfig } from '@/lib/calculos';
import { calcularAlertas, contarPorNivel } from '@/lib/alertas';

export default async function LayoutDashboard({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const sessao = await auth();
  if (!sessao?.user?.email) redirect('/login');

  const [logo, alertas] = await Promise.all([getConfig('empresaLogo'), calcularAlertas()]);
  const contagem = contarPorNivel(alertas);

  return (
    <div className="flex min-h-screen">
      <Sidebar logo={logo || undefined} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          nomeUsuario={sessao.user.name ?? 'Usuário'}
          emailUsuario={sessao.user.email}
          totalAlertas={alertas.length}
          alertasCriticos={contagem.critico}
        />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
