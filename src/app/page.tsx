import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full card p-10 text-center">
        <div className="text-4xl font-bold mb-3">🍔 Mesa Digital</div>
        <p className="text-gray-400 mb-8">
          Sistema de atendimento digital. Escaneie o QR Code da sua mesa para fazer pedidos,
          ou acesse as áreas de operação.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link href="/admin/login" className="btn btn-primary">Backoffice</Link>
          <Link href="/kds" className="btn btn-ghost">Cozinha (KDS)</Link>
          <Link href="/waiter" className="btn btn-ghost">Garçom</Link>
          <Link href="/admin" className="btn btn-ghost">Painel</Link>
        </div>
      </div>
    </main>
  );
}
