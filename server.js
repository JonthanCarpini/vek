// Servidor customizado Next.js + Socket.io
// Usa um único processo para servir Next e WebSocket na mesma porta.
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
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

  // Inicializar WhatsApp para unidades habilitadas (Desativado temporariamente para estabilidade)
  /*
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
  */

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
    startIfoodPolling(port);
  });
});

// Agendador simples para polling iFood via endpoint interno.
// Usa fetch para http://localhost:<port>/api/internal/ifood/poll protegido pelo JWT_SECRET.
function startIfoodPolling(port) {
  // Credenciais podem estar no .env OU no banco (configuradas via /admin/ifood).
  // Sempre agendamos; o endpoint interno verifica e retorna skipped se ausentes.
  const interval = parseInt(process.env.IFOOD_POLLING_INTERVAL_MS || '30000', 10);
  const secret = process.env.JWT_SECRET || '';
  const url = `http://127.0.0.1:${port}/api/internal/ifood/poll`;

  console.log(`[iFood] Polling agendado a cada ${interval}ms via ${url}`);

  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'x-internal-secret': secret },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`[iFood] Polling retornou ${res.status}: ${body.slice(0, 200)}`);
      }
    } catch (err) {
      console.error('[iFood] Falha ao chamar endpoint de polling:', err?.message || err);
    } finally {
      running = false;
    }
  }, interval);
}
