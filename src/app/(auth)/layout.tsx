export default function LayoutAuth({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <div className="min-h-screen bg-background">{children}</div>;
}
