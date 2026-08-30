import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NaoEncontrado(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <FileQuestion className="h-8 w-8 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Página não encontrada</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        O endereço acessado não existe ou foi movido.
      </p>
      <Button asChild>
        <Link href="/dashboard">Voltar ao dashboard</Link>
      </Button>
    </main>
  );
}
