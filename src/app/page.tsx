'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRScanner } from '@/components/QRScanner';
import { MapPin, Phone, Clock, QrCode, Download, ArrowRight, Instagram, Globe, Bike, Home as HomeIcon } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);

  useEffect(() => {
    // Busca informações da unidade
    fetch('/api/v1/public/unit')
      .then(r => r.json())
      .then(j => {
        if (j.data?.unit) setUnit(j.data.unit);
      })
      .catch(() => {});

    // Verifica se já tem uma sessão ativa
    const keys = Object.keys(localStorage);
    const sessionKey = keys.find(k => k.startsWith('md:session:'));
    if (sessionKey) {
      try {
        const saved = JSON.parse(localStorage.getItem(sessionKey)!);
        setSession({ ...saved, token: sessionKey.split(':')[2] });
      } catch {}
    }

    // PWA Install Prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  }

  function handleScan(text: string) {
    setShowScanner(false);
    try {
      if (text.includes('/m/')) {
        const token = text.split('/m/')[1]?.split('?')[0];
        if (token) {
          // Salva nome/telefone se houver no localstorage para pré-preenchimento
          const savedName = localStorage.getItem('md:customer:name');
          const savedPhone = localStorage.getItem('md:customer:phone');
          router.push(`/m/${token}${savedName ? `?name=${encodeURIComponent(savedName)}` : ''}${savedPhone ? `&phone=${encodeURIComponent(savedPhone)}` : ''}`);
          return;
        }
      }
    } catch {}
    router.push(`/m/${text}`);
  }

  const primaryColor = unit?.primaryColor || '#ea580c';

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white">
      {/* Hero Section com Background */}
      <section className="relative h-[65vh] flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={unit?.logoUrl || "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=1200"} 
            alt="" 
            className="w-full h-full object-cover opacity-30 scale-110 blur-[2px]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0b0b0f]/80 to-[#0b0b0f]"></div>
        </div>

        <div className="relative z-10 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          {unit?.logoUrl ? (
            <img src={unit.logoUrl} alt={unit.name} className="h-28 w-auto mx-auto mb-6 drop-shadow-[0_0_20px_rgba(234,88,12,0.3)]" />
          ) : (
            <div className="w-24 h-24 bg-orange-600 rounded-[2rem] flex items-center justify-center text-5xl mx-auto mb-6 shadow-2xl shadow-orange-600/20 rotate-3">🍔</div>
          )}
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
            {unit?.name || 'Espetinho do Chef'}
          </h1>
          <div className="flex flex-col items-center gap-2">
            <p className="text-gray-400 text-lg max-w-md mx-auto leading-relaxed">
              {unit?.slug && (unit?.deliveryEnabled || unit?.takeoutEnabled) ? (
                <>No restaurante? Escaneie a mesa. <br/>Em casa? Peça pelo delivery.</>
              ) : (
                <>Bem-vindo à nossa mesa digital. <br/>Escaneie o código da sua mesa para começar.</>
              )}
            </p>
            {unit && (
              <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${unit.isOpen ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                {unit.isOpen ? '● Aberto Agora' : '○ Fechado'}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Ações Principais Floating */}
      <section className="px-6 -mt-16 relative z-20 max-w-md mx-auto flex flex-col gap-3">
        {session ? (
          <Link 
            href={`/m/${session.token}`}
            className="w-full bg-[#1f1f2b]/95 backdrop-blur-xl p-6 rounded-[2.5rem] border border-orange-500/20 shadow-2xl flex items-center justify-between group active:scale-95 transition-all duration-300"
          >
            <div className="text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                <span className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em]">Sessão em curso</span>
              </div>
              <div className="text-2xl font-black">Mesa {session.session.tableNumber}</div>
              <div className="text-sm text-gray-500">Toque para continuar seu pedido</div>
            </div>
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
              {/* @ts-ignore */}
              <ArrowRight color={primaryColor} size={24} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ) : (
          <>
            <button
              onClick={() => setShowScanner(true)}
              className="w-full bg-orange-600 p-6 rounded-[2.5rem] flex items-center justify-between active:scale-95 transition-all duration-300 shadow-2xl shadow-orange-900/40 group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <div className="text-left relative z-10 flex items-start gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  {/* @ts-ignore */}
                  <HomeIcon size={20} color="white" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-orange-100 opacity-80">Estou no restaurante</div>
                  <div className="text-2xl font-black leading-tight">Escanear Mesa</div>
                  <div className="text-orange-100 text-xs opacity-80 font-medium">Abra sua conta e peça agora</div>
                </div>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center relative z-10 shrink-0">
                {/* @ts-ignore */}
                <QrCode size={32} color="white" />
              </div>
            </button>

            {unit?.slug && (unit?.deliveryEnabled || unit?.takeoutEnabled) && (
              <Link
                href={`/delivery/${unit.slug}`}
                className="w-full bg-[#1f1f2b]/95 backdrop-blur-xl p-6 rounded-[2.5rem] border border-orange-500/30 shadow-2xl flex items-center justify-between active:scale-95 transition-all duration-300 group"
              >
                <div className="text-left flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange-500/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    {/* @ts-ignore */}
                    <Bike size={20} color={primaryColor} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">Estou em casa</div>
                    <div className="text-2xl font-black leading-tight">
                      {unit.deliveryEnabled && unit.takeoutEnabled
                        ? 'Delivery ou Retirada'
                        : unit.deliveryEnabled
                          ? 'Pedir Delivery'
                          : 'Retirar no Balcão'}
                    </div>
                    <div className="text-gray-400 text-xs font-medium">
                      {unit.deliveryEnabled ? 'Receba na sua porta' : 'Pegue no balcão quando estiver pronto'}
                    </div>
                  </div>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-orange-500/20 transition-colors">
                  {/* @ts-ignore */}
                  <ArrowRight color={primaryColor} size={22} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )}
          </>
        )}

        {installPrompt && (
          <button 
            onClick={handleInstall}
            className="w-full bg-[#1f1f2b]/50 backdrop-blur-md p-5 rounded-[2rem] border border-gray-800/50 flex items-center gap-4 active:scale-95 transition-all hover:bg-[#1f1f2b]/80"
          >
            <div className="w-12 h-12 bg-gray-800 rounded-2xl flex items-center justify-center">
              {/* @ts-ignore */}
              <Download color="#9ca3af" size={20} />
            </div>
            <div className="text-left">
              <div className="font-bold">Baixar Aplicativo</div>
              <div className="text-xs text-gray-500">Instale no seu celular para acesso rápido</div>
            </div>
          </button>
        )}
      </section>

      {/* Info do Restaurante Grid */}
      <section className="p-8 mt-4 space-y-8 max-w-md mx-auto pb-32">
        <div className="grid gap-6">
          <div className="flex gap-4 items-start p-2">
            <div className="w-12 h-12 rounded-2xl bg-[#1f1f2b] flex items-center justify-center shrink-0 shadow-lg border border-gray-800/50">
              {/* @ts-ignore */}
              <MapPin color={primaryColor} size={20} />
            </div>
            <div>
              <div className="font-bold text-gray-200">Endereço</div>
              <p className="text-sm text-gray-500 leading-snug">{unit?.address || 'Av. Principal, 1000 - Centro'}</p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-2">
            <div className="w-12 h-12 rounded-2xl bg-[#1f1f2b] flex items-center justify-center shrink-0 shadow-lg border border-gray-800/50">
              {/* @ts-ignore */}
              <Phone color={primaryColor} size={20} />
            </div>
            <div>
              <div className="font-bold text-gray-200">Contato</div>
              <p className="text-sm text-gray-500 leading-snug">{unit?.phone || '(11) 99999-9999'}</p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-2">
            <div className="w-12 h-12 rounded-2xl bg-[#1f1f2b] flex items-center justify-center shrink-0 shadow-lg border border-gray-800/50">
              {/* @ts-ignore */}
              <Clock color={primaryColor} size={20} />
            </div>
            <div>
              <div className="font-bold text-gray-200">Horário</div>
              {unit?.currentSchedule ? (
                <p className="text-sm text-gray-500 leading-snug">
                  Hoje: {unit.currentSchedule.openTime} às {unit.currentSchedule.closeTime}
                </p>
              ) : (
                <p className="text-sm text-gray-500 leading-snug">Terça a Domingo: 18:00 às 00:00</p>
              )}
            </div>
          </div>
        </div>

        {/* Redes Sociais */}
        <div className="flex justify-center gap-4 py-4">
          {unit?.instagram && (
            <a href={`https://instagram.com/${unit.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-gray-500 hover:text-orange-500 transition-colors border border-gray-800/50">
              <Instagram size={20} />
            </a>
          )}
          {unit?.whatsapp && (
            <a href={`https://wa.me/55${unit.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-gray-500 hover:text-orange-500 transition-colors border border-gray-800/50">
              {/* @ts-ignore */}
              <Phone size={18} />
            </a>
          )}
        </div>

        {/* Footer Adm */}
        <div className="pt-8 border-t border-gray-800/30 flex flex-wrap justify-center gap-6 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500">
          <Link href="/admin/login" className="text-[9px] font-black uppercase tracking-[0.3em] hover:text-orange-500">Painel</Link>
          <Link href="/waiter" className="text-[9px] font-black uppercase tracking-[0.3em] hover:text-orange-500">Garçom</Link>
          <Link href="/kds" className="text-[9px] font-black uppercase tracking-[0.3em] hover:text-orange-500">Cozinha</Link>
          <Link href="/cashier" className="text-[9px] font-black uppercase tracking-[0.3em] hover:text-orange-500">Caixa</Link>
        </div>
      </section>

      {/* Scanner Modal */}
      {showScanner && (
        <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}
    </main>
  );
}



