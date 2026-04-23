'use client';

import { useState } from 'react';
import { ArrowLeft, Phone, MessageCircle } from 'lucide-react';
import { useDelivery } from '../_lib/context';
import { deliveryApi, maskPhone } from '../_lib/api';

type Stage = 'phone' | 'name' | 'code';

export default function LoginStep() {
  const { loginSuccess, goTo } = useDelivery();
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    setLoading(true);
    setError(null);
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Telefone inválido');
      setLoading(false);
      return;
    }
    const res = await deliveryApi.requestOtp(cleanPhone);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.data.debugCode) setDebugCode(res.data.debugCode);
    setStage('name');
  };

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    if (code.length !== 6) {
      setError('Código deve ter 6 dígitos');
      setLoading(false);
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      setError('Informe seu nome');
      setLoading(false);
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const res = await deliveryApi.verifyOtp(cleanPhone, code, name.trim());
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    loginSuccess(res.data.customer);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-2">
        <button onClick={() => goTo('menu')} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold">Entrar</h1>
      </div>

      <div className="flex-1 px-4 py-8 max-w-md mx-auto w-full">
        {stage === 'phone' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="inline-flex w-16 h-16 bg-orange-100 rounded-full items-center justify-center mb-3">
                <MessageCircle className="w-8 h-8 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold">Informe seu WhatsApp</h2>
              <p className="text-sm text-gray-500 mt-1">
                Enviaremos um código de 6 dígitos para confirmar seu número
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Número do WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  autoFocus
                />
              </div>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button
              onClick={handleRequestOtp}
              disabled={loading || !phone}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </div>
        )}

        {stage === 'name' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">Como podemos te chamar?</h2>
              <p className="text-sm text-gray-500 mt-1">Seu nome aparecerá no pedido</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Seu nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                autoFocus
              />
            </div>
            <button
              onClick={() => {
                if (!name.trim() || name.trim().length < 2) {
                  setError('Informe seu nome');
                  return;
                }
                setError(null);
                setStage('code');
              }}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition"
            >
              Continuar
            </button>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        )}

        {stage === 'code' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">Digite o código</h2>
              <p className="text-sm text-gray-500 mt-1">
                Enviamos um código para <strong>{maskPhone(phone)}</strong>
              </p>
              {debugCode && (
                <div className="mt-2 text-xs bg-yellow-50 border border-yellow-200 p-2 rounded">
                  <strong>DEV:</strong> código é <code className="font-mono">{debugCode}</code>
                </div>
              )}
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full px-4 py-4 border rounded-lg text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              autoFocus
            />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
            <button
              onClick={() => { setStage('phone'); setCode(''); setError(null); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Trocar número
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
