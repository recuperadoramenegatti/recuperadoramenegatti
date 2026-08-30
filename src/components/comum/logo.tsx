import * as React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  tamanho?: number;
  className?: string;
  /** Logo enviado pelo usuário nas Configurações (data URL). */
  src?: string;
}

/**
 * Marca da Recuperadora Menegatti.
 * Desenho vetorial próprio (engrenagem + eixo) para não depender de arquivo
 * externo; se a empresa subir um logo nas Configurações, ele tem precedência.
 */
export function Logo({ tamanho = 36, className, src }: LogoProps): React.JSX.Element {
  if (src) {
    return (
      <img
        src={src}
        alt="Logo da Recuperadora Menegatti"
        width={tamanho}
        height={tamanho}
        className={cn('rounded-xl object-contain', className)}
      />
    );
  }

  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Recuperadora Menegatti"
    >
      <defs>
        <linearGradient id="menegatti-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#menegatti-grad)" />
      <path
        d="M24 12.5a11.5 11.5 0 1 0 0 23 11.5 11.5 0 0 0 0-23Zm0 4a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15Z"
        fill="#0A0F1E"
        fillOpacity="0.9"
      />
      <path
        d="M22 6h4v5h-4V6ZM22 37h4v5h-4v-5ZM6 22h5v4H6v-4ZM37 22h5v4h-5v-4ZM11.2 8.4l3.5 3.5-2.8 2.8-3.5-3.5 2.8-2.8ZM33.3 30.5l3.5 3.5-2.8 2.8-3.5-3.5 2.8-2.8ZM36.8 8.4l2.8 2.8-3.5 3.5-2.8-2.8 3.5-3.5ZM14.7 30.5l2.8 2.8-3.5 3.5-2.8-2.8 3.5-3.5Z"
        fill="#0A0F1E"
        fillOpacity="0.9"
      />
      <circle cx="24" cy="24" r="3.2" fill="#0A0F1E" fillOpacity="0.9" />
    </svg>
  );
}

/** Marca com o nome ao lado, para sidebar e login. */
export function LogoCompleto({
  tamanho = 36,
  className,
  src,
  subtitulo = 'Gestão Financeira',
}: LogoProps & { subtitulo?: string }): React.JSX.Element {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Logo tamanho={tamanho} src={src} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-bold tracking-tight">RECUPERADORA</div>
        <div className="truncate bg-gradient-hero bg-clip-text text-sm font-bold tracking-[0.18em] text-transparent">
          MENEGATTI
        </div>
        {subtitulo ? (
          <div className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
            {subtitulo}
          </div>
        ) : null}
      </div>
    </div>
  );
}
