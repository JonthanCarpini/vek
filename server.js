// Servidor customizado Next.js + Socket.io
// Usa um único processo para servir Next e WebSocket na mesma porta.
console.log('[Server] Iniciando processo...');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
console.log(`[Server] Iniciando Next.js (dev=${dev})...`);
const app = next({ dev });
const handle = app.getRequestHandler();

console.log('[Server] Preparando app...');
app.prepare().then(() => {
  console.log('[Server] App preparado. Criando servidor HTTP...');
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  // Expor globalmente para que route handlers possam emitir
  globalThis.__io = io;

  console.log('[Server] Importando serviços de WhatsApp e Prisma...');
  // Inicializar WhatsApp para unidades habilitadas
  const { whatsappService } = require('./src/lib/whatsapp');
  const { prisma } = require('./src/lib/prisma');
  
  async function initWhatsApp() {
    try {
      const units = await prisma.unit.findMany({ where: { whatsappEnabled: true } });
      console.log(`[WhatsApp] Inicializando ${units.length} unidades...`);
      for (const unit of units) {
        await whatsappService.initialize(unit.id);
      }
    } catch (err) {
      console.error('[WhatsApp] Falha ao inicializar:', err);
    }
  }
  initWhatsApp();

  io.on('connection', (socket) => {
    // O cliente diz em qual(is) room(s) quer entrar
    socket.on('join', (rooms) => {
      if (!rooms) return;
      const list = Array.isArray(rooms) ? rooms : [rooms];
      list.forEach((r) => {
        if (typeof r === 'string' && r.length < 200) socket.join(r);
      });
    });
    socket.on('leave', (room) => {
      if (typeof room === 'string') socket.leave(room);
    });
  });

  httpServer.listen(port, () => {
    console.log(`[mesa-digital] pronto em http://localhost:${port}`);
  });
});
