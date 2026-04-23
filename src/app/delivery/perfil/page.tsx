'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, Phone, LogOut, ChevronRight, MapPin, ClipboardList,
  ShieldCheck, Loader2,
} from 'lucide-react';
import { useDelivery } from '../_lib/context';
import { deliveryApi, maskPhone } from '../_lib/api';
import { PushToggle } from '../_components/PushToggle';

export default function PerfilPage() {
  const router = useRouter();
  const { customer, logout } = useDelivery();

  if (!customer) {
    return <LoginView onSuccess={() => router.push('/delivery')} />;
  }

  const handleLogout = async () => {
    if (!confirm('Sair da sua conta?')) return;
    await logout();
    router.replace('/delivery');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white border-b">
        <div className="max-w-md mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-gray-800">Perfil</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* Card do usuário */}
        <div className="bg-white rounded-xl p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl font-bold">
            {customer.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-800 truncate">{customer.name}</div>
            <div className="text-sm text-gray-500 truncate">{maskPhone(customer.phone || '')}</div>
          </div>
        </div>

        {/* Atalhos */}
        <div className="bg-white rounded-xl overflow-hidden">
          <MenuItem
            icon={ClipboardList}
            label="Meus pedidos"
            href="/delivery/pedidos"
          />
          <MenuItem
            icon={MapPin}
            label="Endereços salvos"
            href="/delivery/enderecos"
          />
        </div>

        {/* Toggle de notificações push — só aparece se o browser suporta e a loja configurou VAPID */}
        <PushToggle />

        <div className="bg-white rounded-xl overflow-hidden">
          <div className="p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-gray-600">
              Sua sessão permanece ativa por 60 dias. Você só precisa fazer login de novo após esse período ou ao sair.
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 bg-white border border-red-200 text-red-600 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>

        <p className="text-center text-xs text-gray-400 pt-2">
          Mesa Digital · Delivery
        </p>
      </main>
    </div>
  );
}

function MenuItem({
  icon: Icon, label, href,
}: { icon: any; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 hover:bg-gray-50 border-b last:border-b-0"
    >
      <Icon className="w-5 h-5 text-gray-500" />
      <span className="flex-1 text-sm text-gray-800">{label}</span>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </Link>
  );
}

function LoginView({ onSuccess }: { onSuccess: () => void }) {
  const { loginSuccess } = useDelivery();
  const [step, setStep] = useState<'phone' | 'code' | 'name'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestOtp = async () => {
    setError(null);
    setLoading(true);
    const res = await deliveryApi.requestOtp(phone);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setStep('code');
  };

  const verifyOtp = async () => {
    setError(null);
    setLoading(true);
    const res = await deliveryApi.verifyOtp(phone, code, name || undefined);
    setLoading(false);
    if (!res.ok) {
      if (res.status === 404 || /nome/i.test(res.error)) {
        setStep('name');
        return;
      }
      setError(res.error);
      return;
    }
    loginSuccess(res.data.customer);
    onSuccess();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 to-white">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-sm">
        <div className="text-center mb-5">
          <div className="inline-flex w-14 h-14 rounded-full bg-orange-100 items-center justify-center mb-3">
            {step === 'phone' && <Phone className="w-6 h-6 text-orange-500" />}
            {step === 'code' && <ShieldCheck className="w-6 h-6 text-orange-500" />}
            {step === 'name' && <User className="w-6 h-6 text-orange-500" />}
          </div>
          <h1 className="text-xl font-bold text-gray-800">
            {step === 'phone' && 'Entrar'}
            {step === 'code' && 'Código enviado'}
            {step === 'name' && 'Como te chamamos?'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 'phone' && 'Informe seu WhatsApp para receber o código'}
            {step === 'code' && `Enviamos um código via WhatsApp para ${maskPhone(phone)}`}
            {step === 'name' && 'Primeiro acesso: nos diga seu nome completo'}
          </p>
        </div>

        {step === 'phone' && (
          <div className="space-y-3">
            <input
              type="tel"
              inputMode="tel"
              value={maskPhone(phone)}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="(11) 99999-9999"
              className="w-full px-4 py-3 border rounded-lg text-center text-lg"
              autoFocus
            />
            <button
              onClick={requestOtp}
              disabled={loading || phone.replace(/\D/g, '').length < 10}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar código'}
            </button>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full px-4 py-3 border rounded-lg text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
            />
            <button
              onClick={verifyOtp}
              disabled={loading || code.length < 4}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
            </button>
            <button
              onClick={() => setStep('phone')}
              className="w-full text-sm text-gray-500"
            >
              Voltar
            </button>
          </div>
        )}

        {step === 'name' && (
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full px-4 py-3 border rounded-lg text-lg"
              autoFocus
            />
            <button
              onClick={verifyOtp}
              disabled={loading || name.trim().length < 2}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continuar'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">
            {error}
          </div>
        )}

        <div className="mt-5 pt-5 border-t">
          <Link href="/delivery" className="block text-center text-sm text-gray-500">
            Continuar sem entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
