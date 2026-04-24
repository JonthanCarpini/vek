import { Client, LocalAuth } from 'whatsapp-web.js';
import { prisma } from './prisma';
import QRCode from 'qrcode';

// Declaração para evitar erro de tipagem no globalThis
declare global {
  var __io: any;
}

class WhatsAppService {
  private clients: Map<string, Client> = new Map();

  async initialize(unitId: string) {
    if (this.clients.has(unitId)) return;

    const unit = await prisma.unit.findUnique({ where: { id: unitId } }) as any;
    if (!unit || !unit.whatsappEnabled) return;

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: unitId,
        dataPath: './.wwebjs_auth'
      }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: process.env.CHROME_PATH || undefined,
        handleSIGINT: false,
      }
    });

    client.on('qr', async (qr) => {
      console.log(`[WhatsApp] QR Code gerado para unidade: ${unitId}`);
      const qrDataUrl = await QRCode.toDataURL(qr);
      await (prisma.unit as any).update({
        where: { id: unitId },
        data: { whatsappStatus: 'qr', whatsappSession: qrDataUrl }
      });
      
      // Notificar via socket se possível
      if (globalThis.__io) {
        globalThis.__io.to(`unit:${unitId}:dashboard`).emit('whatsapp.qr', { qrDataUrl });
      }
    });

    client.on('ready', async () => {
      console.log(`[WhatsApp] Cliente pronto para unidade: ${unitId}`);
      await (prisma.unit as any).update({
        where: { id: unitId },
        data: { whatsappStatus: 'connected', whatsappSession: null }
      });

      if (globalThis.__io) {
        globalThis.__io.to(`unit:${unitId}:dashboard`).emit('whatsapp.status', { status: 'connected' });
      }
    });

    client.on('disconnected', async (reason) => {
      console.log(`[WhatsApp] Cliente desconectado (${reason}) para unidade: ${unitId}`);
      await (prisma.unit as any).update({
        where: { id: unitId },
        data: { whatsappStatus: 'disconnected', whatsappSession: null }
      });
      this.clients.delete(unitId);

      if (globalThis.__io) {
        globalThis.__io.to(`unit:${unitId}:dashboard`).emit('whatsapp.status', { status: 'disconnected' });
      }

      // Auto-reconecta após 30s, salvo se foi logout manual
      if (reason !== 'LOGOUT') {
        setTimeout(async () => {
          try {
            const unit = await (prisma.unit as any).findUnique({ where: { id: unitId } });
            if (unit?.whatsappEnabled && !this.clients.has(unitId)) {
              console.log(`[WhatsApp] Auto-reconectando unidade: ${unitId}`);
              await this.initialize(unitId);
            }
          } catch (e) {
            console.error(`[WhatsApp] Falha na auto-reconexão de ${unitId}:`, e);
          }
        }, 30_000);
      }
    });

    this.clients.set(unitId, client);
    client.initialize().catch(err => {
      console.error(`[WhatsApp] Erro ao inicializar unidade ${unitId}:`, err);
    });
  }

  async disconnect(unitId: string) {
    const client = this.clients.get(unitId);
    if (client) {
      await client.logout();
      await client.destroy();
      this.clients.delete(unitId);
    }
      await (prisma.unit as any).update({
        where: { id: unitId },
        data: { whatsappStatus: 'disconnected', whatsappSession: null }
      });
  }

  async sendMessage(unitId: string, to: string, message: string) {
    const client = this.clients.get(unitId);
    if (!client) {
      // Tentar inicializar se estiver habilitado
      await this.initialize(unitId);
      const retryClient = this.clients.get(unitId);
      if (!retryClient) return false;
    }

    try {
      const formattedTo = to.replace(/\D/g, '');
      const finalTo = formattedTo.startsWith('55') ? formattedTo : `55${formattedTo}`;
      await client!.sendMessage(`${finalTo}@c.us`, message);
      return true;
    } catch (err) {
      console.error(`[WhatsApp] Erro ao enviar mensagem para ${to}:`, err);
      return false;
    }
  }

  getClient(unitId: string) {
    return this.clients.get(unitId);
  }
}

export const whatsappService = new WhatsAppService();
