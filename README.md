# 🍔 Mesa Digital

Sistema de atendimento digital para lanchonetes via QR Code na mesa. Cliente escaneia QR → cadastro → cardápio → pedido → acompanha em tempo real. Backoffice completo, KDS para cozinha e painel do garçom.

## 🧱 Stack

- **Frontend + Backend:** Next.js 15 (App Router, fullstack)
- **Banco:** MySQL 8 + Prisma ORM
- **Realtime:** Socket.io (servidor customizado, mesma porta do Next)
- **Auth:** JWT (staff + sessão de mesa)
- **UI:** TailwindCSS
- **QR Code:** `qrcode` (PNG/SVG)

## 📁 Estrutura

```
mesa_digital/
├─ server.js                      # Next + Socket.io custom server
├─ prisma/
│  ├─ schema.prisma               # Schema completo
│  └─ seed.ts                     # Seed de exemplo
├─ src/
│  ├─ lib/                        # prisma, auth, socket, validators, guard
│  └─ app/
│     ├─ m/[token]/               # PWA Cliente
│     ├─ kds/                     # Painel Cozinha
│     ├─ waiter/                  # Painel Garçom
│     ├─ admin/                   # Backoffice completo
│     │  ├─ login, orders, products, categories,
│     │  ├─ tables (QR), users, reports, calls
│     └─ api/v1/                  # REST API versionada
│        ├─ public/               # cliente (checkin, menu, orders, calls)
│        ├─ auth/                 # login staff
│        ├─ admin/                # CRUD + dashboard + reports
│        ├─ kitchen/              # KDS
│        ├─ waiter/               # chamadas
│        └─ cashier/              # fechamento de conta
├─ docker-compose.yml
└─ Dockerfile
```

## 🚀 Como rodar

### Desenvolvimento local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar .env (copiar do exemplo)
cp .env.example .env
# Edite DATABASE_URL para seu MySQL local

# 3. Criar banco e tabelas
npx prisma migrate dev --name init

# 4. Seed com dados de exemplo (admin + menu + 10 mesas)
npm run seed

# 5. Iniciar
npm run dev
```

Acesse `http://localhost:3000`.

### Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run seed
```

## 🔐 Credenciais padrão (após seed)

| Papel | E-mail | Senha |
|---|---|---|
| Admin | admin@mesadigital.com | admin123 |
| Cozinha | cozinha@mesadigital.com | admin123 |
| Garçom | garcom@mesadigital.com | admin123 |
| Caixa | caixa@mesadigital.com | admin123 |

## 🔗 URLs principais

- `/` — Landing
- `/m/{qrToken}` — PWA do cliente (fluxo da mesa)
- `/admin/login` → `/admin` — Backoffice
- `/kds` — Painel da cozinha (colunas por status, tempo real)
- `/waiter` — Painel do garçom (chamadas)

O QR Code PDF/PNG de cada mesa é gerado em `Admin → Mesas & QR`.

## 🔌 API (resumo)

### Público (cliente, `x-session-token`)
- `POST /api/v1/public/checkin` — `{ qrToken, name, phone }` → retorna `token`
- `GET  /api/v1/public/menu` — cardápio por unidade
- `POST /api/v1/public/orders` — envia pedido
- `GET  /api/v1/public/orders` — pedidos da sessão
- `POST /api/v1/public/calls` — `{ type: waiter|bill|help }`
- `GET  /api/v1/public/session/summary` — resumo da conta

### Staff (`Authorization: Bearer ...`)
- `POST /api/v1/auth/login`
- `GET  /api/v1/auth/me`
- `CRUD /api/v1/admin/{categories,products,tables,users}`
- `GET  /api/v1/admin/tables/:id/qr?format=png|svg` — QR pronto
- `GET  /api/v1/admin/orders` — lista com filtro `?status=`
- `GET  /api/v1/admin/dashboard` — métricas em tempo real
- `GET  /api/v1/admin/reports/sales?days=7`
- `GET  /api/v1/kitchen/orders`
- `PATCH /api/v1/kitchen/orders/:id/status`
- `PATCH /api/v1/kitchen/items/:id/status`
- `GET  /api/v1/waiter/calls`
- `PATCH /api/v1/waiter/calls/:id/attend`
- `POST /api/v1/cashier/sessions/:id/close`

## 📡 Tempo real (Socket.io)

Rooms disparados pelo servidor:
- `unit:{unitId}:kitchen` — novos pedidos / mudança de status
- `unit:{unitId}:waiters` — chamadas
- `unit:{unitId}:dashboard` — métricas
- `session:{sessionId}` — status do pedido para o cliente

Eventos: `order.created`, `order.updated`, `order.status_changed`, `order.item_status_changed`, `call.created`, `call.attended`, `session.closed`.

## 🧪 Fluxo de teste end-to-end

1. `npm run dev` + seed.
2. Abrir `/admin/login` → `admin@mesadigital.com` / `admin123`.
3. Em **Mesas & QR**, clicar em "QR Code" da Mesa 1 e abrir a imagem (ou abrir direto `/m/{qrToken}` em outra aba/celular).
4. Fazer check-in (nome + telefone) → cardápio → adicionar itens → enviar pedido.
5. Abrir `/kds` em outra aba → pedido aparece em tempo real → avançar status.
6. Cliente vê o status mudar na timeline em tempo real.
7. Cliente aperta "Chamar garçom" → `/waiter` recebe a chamada.
8. Cliente pede conta → `/admin/calls` ou `/waiter` atende → caixa fecha sessão via API.

## 🛡️ Segurança

- Senhas com `bcryptjs` (10 rounds).
- JWT separado para staff e sessão de mesa.
- RBAC por papel (`super_admin | admin | manager | waiter | kitchen | cashier`).
- Validação de entrada com Zod em todas as rotas.
- QR token de 128 bits aleatórios, único por mesa.

## 📈 Escalabilidade e próximos passos

**Implementado (MVP + Backoffice completo):**
- ✅ Fluxo completo cliente → cozinha → entrega
- ✅ Gestão de cardápio, mesas (com QR imprimível), usuários
- ✅ KDS em tempo real com alerta de atraso
- ✅ Painel do garçom com chamadas em tempo real
- ✅ Dashboard e relatórios de vendas
- ✅ Fechamento de sessão de mesa

**Próximos passos (roadmap):**
- 💳 Integração de pagamentos (Pix / cartão via Mercado Pago)
- 🏬 Multi-tenant completo (franquias) — schema já preparado (`Tenant`, `Unit`)
- 💎 Programa de fidelidade por telefone
- 📲 Notificações WhatsApp/push
- 🧾 Emissão NFC-e
- 📱 App React Native reusando API

**Para escalar horizontalmente:**
- Ativar Redis + adapter Socket.io (`@socket.io/redis-adapter`)
- Réplicas read-only do MySQL para relatórios
- CDN + storage S3 para imagens de produto
- OpenTelemetry + Grafana + Sentry

## 📝 Análise de escalabilidade e manutenibilidade

A arquitetura escolhida (monolito modular Next.js fullstack + Socket.io custom server) entrega o produto completo com baixo custo operacional e alta velocidade de desenvolvimento, sem sacrificar evolução futura. Cada domínio (`menu`, `orders`, `tables`, `calls`, `cashier`) está isolado em suas próprias rotas REST com validação Zod e guards RBAC claros, o que facilita extrair módulos para microsserviços quando o volume exigir. O ponto mais sensível é o acoplamento temporal entre pedido → KDS → notificação; hoje o servidor é único, então o `emit` é imediato, mas ao escalar horizontalmente deve-se adotar **Transactional Outbox** (persistir evento + publicar assíncrono) e Redis adapter para garantir entrega entre réplicas.

**Próximos passos sugeridos:** (1) adicionar testes e2e com Playwright cobrindo o fluxo cliente→cozinha; (2) instrumentar com OpenTelemetry desde o dia 1 para ter SLOs reais; (3) extrair Socket.io para processo próprio assim que o número de mesas ativas simultâneas ultrapassar ~1000 conexões; (4) migrar `orders` para particionamento mensal quando atingir ~10M linhas.
