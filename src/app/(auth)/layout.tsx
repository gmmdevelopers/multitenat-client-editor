export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-gray-950 text-gray-100 flex flex-col justify-between relative overflow-hidden">
      {/* Fondo decorativo con gradiente tenue */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />

      {/* Header simplificado con branding */}
      <header className="relative z-10 w-full max-w-7xl mx-auto p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30">
            S
          </div>
          <span className="font-bold tracking-tight text-lg text-white">
            SaaS Platform
          </span>
        </div>
      </header>

      {/* Contenedor central donde se renderiza /login o /register */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        {children}
      </main>

      {/* Footer minimalista */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto p-6 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} SaaS Platform. Todos los derechos
        reservados.
      </footer>
    </div>
  );
}
