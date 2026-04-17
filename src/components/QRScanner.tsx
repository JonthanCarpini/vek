'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

type Props = {
  onScan: (text: string) => void;
  onClose: () => void;
};

export function QRScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        if (scannerRef.current) {
          scannerRef.current.clear().then(() => {
            onScan(decodedText);
          }).catch(err => console.error(err));
        }
      },
      () => {
        // Ignorar erros de scan (falha ao ler quadro)
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error(err));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1f1f2b] rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <h3 className="font-bold text-white">Escaneie o QR Code</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white px-2 py-1">Fechar</button>
        </div>
        <div className="p-4">
          <div id="qr-reader" className="w-full overflow-hidden rounded-2xl border border-gray-800"></div>
          <div className="mt-4 text-gray-500 text-[10px] text-center uppercase tracking-widest">
            Aponte a câmera para o QR Code da mesa
          </div>
        </div>
      </div>
    </div>
  );
}

