# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git & Deploy

The app runs in production on a Contabo VPS (`root@84.46.240.106`). There is no local dev environment — all changes must be deployed to the VPS after every commit.

### Full deploy sequence (required after every code change)

**Step 1 — commit and push to GitHub:**
```bash
git add <changed files>
git commit -m "<descriptive message>"
git push origin main
```

**Step 2 — deploy on the VPS:**
```bash
ssh root@84.46.240.106 "
  cd /opt/espetinhodochef &&
  git pull origin main &&
  docker compose -f docker-compose.prod.yml --env-file .env up -d --build
"
```

**Step 3 — if `schema.prisma` changed, also run migrations:**
```bash
ssh root@84.46.240.106 "
  cd /opt/espetinhodochef &&
  docker compose -f docker-compose.prod.yml exec -T app npx prisma db push --skip-generate --accept-data-loss
"
```

### VPS details

| Item | Value |
|------|-------|
| Host | `root@84.46.240.106` |
| Provider | Contabo |
| App directory | `/opt/espetinhodochef` |
| Compose file | `docker-compose.prod.yml` |
| Env file | `.env` (already configured on VPS) |
| Public URL | `https://espetinhodochef.site` |

### Rules
- Stage only the files that were changed (never `git add -A` blindly)
- Always push to GitHub **before** pulling on the VPS
- After deploying, verify the containers are healthy: `ssh root@84.46.240.106 "docker compose -f /opt/espetinhodochef/docker-compose.prod.yml ps"`

## Commands

```bash
# Development
npm run dev              # Start dev server (Next.js + Socket.io via server.js)
npm run build            # Build for production
npm run start            # Run production build
npm run lint             # ESLint (next lint)

# Database
npm run prisma:generate  # Generate Prisma client after schema changes
npm run prisma:migrate   # Create + apply migration (dev)
npm run prisma:deploy    # Apply existing migrations (production)
npm run prisma:studio    # Open Prisma Studio GUI
npm run seed             # Seed example data (admin, tenant, unit, tables, menu)

# Docker (local)
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run seed

# Docker (production)
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## Architecture Overview

**Mesa Digital** is a fullstack restaurant digital ordering system. Customers scan a QR code at their table, check in, browse the menu, and place orders. Staff manage this through role-specific panels.

### Request lifecycle

1. Customer scans QR → `GET /api/v1/public/checkin` → creates `TableSession`, returns session JWT
2. Customer orders → `POST /api/v1/public/orders` → validates ingredients, creates `Order` + `OrderItems`, emits Socket.io events
3. KDS (`/kds`) receives `order.created` event → staff mark items done → emits `order.item_status_changed`
4. Customer PWA subscribes to `session:{sessionId}` room for live order tracking

### Server entry point

`server.js` bootstraps Socket.io on the same port (3000) as Next.js. It attaches the io instance to `globalThis.__io`. API route handlers call helpers in `src/lib/socket.ts` to emit events (e.g., `emitToKitchen(unitId, event, data)`). Never instantiate a new Socket.io instance in route handlers — always use the global.

### API structure

All routes live under `src/app/api/v1/`:

| Prefix | Consumers | Auth |
|--------|-----------|------|
| `/public/` | Customer PWA (dine-in) | Session JWT (`x-session-token` header or `md_session` cookie) |
| `/auth/` | All staff | None (returns JWT) |
| `/admin/` | Admin/Manager | Staff JWT (`Authorization: Bearer` or `md_token` cookie) |
| `/kitchen/` | Kitchen staff | Staff JWT |
| `/waiter/` | Waiter staff | Staff JWT |
| `/cashier/` | Cashier staff | Staff JWT |
| `/delivery/` | Customer (delivery/takeout) | Customer JWT (`x-customer-token` header or `md_customer` cookie, 60d) |
| `/driver/` | Motoboy (delivery driver) | Driver JWT (`x-driver-token` header or `md_driver` cookie, 30d) |
| `/internal/` | Server-to-server (polling, webhooks) | `JWT_SECRET` Bearer |

RBAC is enforced via `src/lib/guard.ts`. Four guards: `requireStaff(req, roles?)`, `requireCustomer(req)`, `requireDriver(req)`, and role-based access. Six staff roles: `super_admin`, `admin`, `manager`, `waiter`, `kitchen`, `cashier`.

Four JWT secrets must stay separate:
- `JWT_SECRET` — staff tokens (30d) + internal endpoints
- `JWT_SESSION_SECRET` — customer dine-in sessions (4h)
- `JWT_CUSTOMER_SECRET` — delivery customer login (60d)
- `JWT_DRIVER_SECRET` — motoboy login (30d)

### Frontend pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page with QR scanner |
| `/m/[token]` | Customer PWA (menu, cart, order tracking, calls) |
| `/kds` | Kitchen Display System |
| `/waiter` | Waiter panel (customer call queue) |
| `/cashier` | Session closing & payment |
| `/admin/*` | Backoffice (login, orders, products, categories, tables, users, reports, settings, whatsapp, ifood, delivery, drivers) |
| `/display` | Carousel display for screens |
| `/delivery` | App-style delivery home: menu + cart (tab "Início"); stack interno login/address/checkout |
| `/delivery/pedidos` | Lista de pedidos do cliente (filtro todos/ativos/concluídos + pull-to-refresh) |
| `/delivery/pedidos/[id]` | Tracking do pedido (reaproveita `OrderTrackingView`) |
| `/delivery/enderecos` | CRUD de endereços salvos (modal com lookup de CEP) |
| `/delivery/perfil` | Perfil + logout; se não logado, exibe fluxo OTP (phone → code → name) |
| `/t/[id]` | Public order tracking page (no auth, accessed via WhatsApp link — usa `OrderTrackingView`) |
| `/driver/login` | Motoboy login (phone + PIN) |
| `/driver` | Motoboy dashboard (assigned deliveries, dispatch/deliver actions, Google Maps link) |
| `/driver/stats` | Motoboy report: today/week/month deliveries, km, avg ticket, commission |

**Single-tenant deployment model.** Each restaurant runs on its own VPS/domain/mobile apps. The `/delivery` route, `/api/v1/delivery/*` endpoints and `/api/v1/public/unit` all resolve the single active Unit server-side — no slug/tenant disambiguation at the URL level. The `Tenant`/`Unit` tables still exist for multi-unit-per-tenant scenarios (e.g., chains on one VPS), but the app assumes one active Unit for public traffic.

### State management

- **Zustand** stores in `src/lib/store.ts` manage client-side state (cart, session, notifications)
- Socket.io client setup in `src/lib/socket-client.ts` (browser side)
- Staff API helpers in `src/lib/staff-client.ts`

### Database

MySQL 8 via Prisma 5. Key model hierarchy:

```
Tenant → Unit → TableEntity → TableSession → Order → OrderItem
                            ↘ Call
              ↘ Product → ProductIngredient → Ingredient
              ↘ User
              ↘ StoreDay → SessionPayment
              ↘ Customer → DeliveryAddress
                         ↘ Order (delivery/takeout)
              ↘ Driver → Order (delivery assignments)
              ↘ OtpCode (WhatsApp login codes)
              ↘ GeocodeCache (Google Maps cache)
              ↘ IfoodToken / IfoodEvent
```

`Order.channel` (`dine_in | ifood | delivery`) and `Order.orderType` (`dine_in | delivery | takeout`) distinguish order sources. Delivery/iFood orders use a **virtual table** (`TableEntity.virtual = true`, number `9998` for delivery, `9999` for iFood) to preserve referential integrity with `tableId`/`sessionId`.

After any `schema.prisma` change, run `prisma:generate` then `prisma:migrate`.

Ingredient stock is validated at order creation time in `src/lib/orders.ts` (dine-in) and `src/lib/delivery/orders.ts` (delivery/takeout).

### Real-time rooms

Socket.io rooms are scoped per unit to prevent cross-unit data leakage:

| Room | Subscribers |
|------|-------------|
| `unit:{unitId}:kitchen` | KDS panel |
| `unit:{unitId}:waiters` | Waiter panel |
| `unit:{unitId}:dashboard` | Admin dashboard |
| `session:{sessionId}` | Customer PWA (dine-in) |
| `driver:{driverId}` | Motoboy dashboard (receives `order.assigned`/`order.unassigned` the instant admin assigns) |
| `order:{orderId}` | Public tracking `/t/[id]` (receives `driver.location` live while status is `dispatched`) |

`src/lib/socket.ts` exposes `emitToDriver(driverId, event, payload)` and `emitToOrderTracking(orderId, event, payload)`. Never emit from a raw Socket.io instance — always go through these helpers so the room naming stays consistent.

### Environment variables

Copy `.env.example` for development. Required vars:

```
DATABASE_URL
JWT_SECRET                  # Staff tokens + internal endpoints
JWT_SESSION_SECRET          # Customer dine-in sessions
JWT_CUSTOMER_SECRET         # Delivery customer login
JWT_DRIVER_SECRET           # Motoboy login
NEXT_PUBLIC_APP_URL         # Must be browser-accessible
NEXT_PUBLIC_SOCKET_URL      # Must be browser-accessible (WebSocket upgrade)

# Optional (per-unit override takes precedence)
GOOGLE_MAPS_API_KEY         # Fallback geocoding key (each Unit can have its own)
IFOOD_CLIENT_ID             # Fallback iFood credentials (each Tenant can have its own)
IFOOD_CLIENT_SECRET
```

`NEXT_PUBLIC_*` vars are bundled into the frontend JS at build time. Per-unit/per-tenant DB overrides for iFood credentials and Google Maps key always take precedence over env fallbacks.

### PWA

Multiple PWA manifests (one per panel) configured via `@ducanh2912/next-pwa` in `next.config.js`. Icons and manifests live in `public/`. The `PwaHead` component in `src/components/` handles per-panel install prompts.

### Validation

All API input is validated with Zod schemas defined in `src/lib/validators.ts`. Add new schemas there before creating API routes.

### Path alias

`@/*` resolves to `./src/*` (configured in `tsconfig.json`).

---

## WhatsApp Integration Module

Connects a WhatsApp Web session per unit using `whatsapp-web.js` (Puppeteer + Chromium). Used for automatic order notifications, delivery OTP login, and tracking links.

### Architecture

- `src/lib/whatsapp.ts` — `whatsappService` singleton with `.initialize(unitId)`, `.sendMessage(unitId, phone, text)`, and QR code emission
- Session persistence in `/app/.wwebjs_auth/` inside the container (must remain chmod 777 in `Dockerfile`)
- `server.js` auto-initializes WhatsApp for every unit with `whatsappEnabled = true` on boot
- QR code is pushed via Socket.io event `whatsapp:qr` to the admin panel
- Unit.whatsappStatus is standardized to `disconnected | qr | connected`

### Docker requirements

`Dockerfile` installs Chromium + Puppeteer system deps in the `base` stage (see `libnss3`, `libgtk-3-0`, etc). **Never remove these packages** — WhatsApp Web breaks without them.

### Triggers sending messages

| Trigger | Message |
|---------|---------|
| Dine-in order created (`createOrderFromItems`) | Full receipt + tracking link |
| Dine-in order marked ready (`sendOrderReadyWhatsApp`) | "Your order is ready" |
| Delivery order created (`createDeliveryOrder`) | Full receipt + `/t/[id]` tracking |
| Delivery status change (`/api/v1/admin/delivery/orders/[id]/status`) | Per-status template (accepted/preparing/ready/dispatched/delivered/cancelled) |
| OTP login request (`requestOtp`) | 6-digit code |

All sends use `whatsappService.sendMessage` which auto-formats the number (prepends `55` if missing). Failures are logged but never block the originating request.

### Admin UI

`/admin/whatsapp` — connect/disconnect, show QR code, show current status, enable/disable.

---

## iFood Integration Module

Official iFood API integration for receiving orders, syncing status, and managing catalog. Works alongside dine-in and delivery channels.

### Architecture

- **OAuth2 client_credentials flow** in `src/lib/ifood/client.ts` — caches access tokens in DB (`IfoodToken`), auto-retries on 401, honors `Retry-After` on 429
- **Polling worker** in `src/lib/ifood/events.ts` — called every 30s by `server.js` via internal endpoint `POST /api/v1/internal/ifood/poll` (authenticated with `JWT_SECRET`)
- **Credentials precedence**: `Tenant.ifoodClientId/Secret` (DB) → `.env` fallback
- **Per-unit flag**: `Unit.ifoodEnabled + Unit.ifoodMerchantId`; polling only runs for enabled units
- **Idempotent event processing**: each `IfoodEvent.id` is upserted; already-acknowledged events are skipped

### Key files

| File | Purpose |
|------|---------|
| `src/lib/ifood/client.ts` | HTTP + OAuth2 + token cache |
| `src/lib/ifood/types.ts` | DTOs for orders, events, merchant |
| `src/lib/ifood/events.ts` | Poll, process PLC/CFM/CAN/DSP/CON, ack in batch |
| `src/lib/ifood/orders.ts` | Map iFood DTO → local `Order` (creates virtual table #9999 + stub products) |
| `src/lib/ifood/actions.ts` | confirm / startPreparation / markReady / dispatch / cancel (syncs kitchen status back to iFood) |
| `src/lib/ifood/merchant.ts` | Store status, pause, resume, interruptions |
| `src/lib/ifood/catalog.ts` | Manual catalog push (category+items+availability) |

### Event mapping

| iFood event | Local action |
|------------|--------------|
| `PLC` (placed) | Create `Order` with `channel='ifood'`, status `received`, emit to KDS |
| `CFM` (confirmed) | Set status `accepted`, `acceptedAt = now` |
| `CAN` (cancelled) | Set status `cancelled`, restock ingredients |
| `DSP` (dispatched) | Set status `dispatched`, `dispatchedAt = now` |
| `CON` (concluded) | Set status `delivered` |

KDS status changes flow **back** to iFood (e.g., staff marking "ready" triggers `markReady` API call) via hook in `/api/v1/kitchen/orders/[id]/status`.

### API routes

| Route | Purpose |
|-------|---------|
| `POST /api/v1/internal/ifood/poll` | Triggered by `server.js` setInterval; processes events for all enabled units |
| `GET/PATCH /api/v1/admin/ifood` | Read/write unit iFood config |
| `GET/PATCH/DELETE /api/v1/admin/ifood/credentials` | Tenant-level Client ID/Secret (secret is write-only after set) |
| `GET /api/v1/admin/ifood/orders` | List local iFood orders |
| `POST /api/v1/admin/ifood/orders/[id]/confirm\|dispatch\|cancel` | Manual actions |
| `GET/POST /api/v1/admin/ifood/status` | Store status + pause/resume |
| `POST /api/v1/admin/ifood/catalog/publish` | Manual catalog sync |

### Admin UI

`/admin/ifood` — tabs: Credentials, Config, Orders, Store Status. Orders display with red `🛵 iFood` badge in KDS and cashier panels.

### Extending

- Add new event codes in `events.ts` → `processEvent` switch
- Per-tenant webhook support: add to `Tenant`, implement `POST /api/v1/webhooks/ifood/[tenantId]` that validates HMAC signature, writes to `IfoodEvent`, lets the poller pick up
- Secret encryption: `IFOOD_CLIENT_SECRET` is currently stored as plain `@db.Text` — migrate to encrypted field with `node:crypto` AES-GCM when adding more tenants

---

## Delivery Module (native)

Self-hosted delivery system — no third-party dependency beyond Google Maps (geocoding) and WhatsApp (OTP + notifications). Supports delivery and takeout in the same flow.

### Customer flow (`/delivery`)

**App-style tabbed layout** (`/delivery/layout.tsx`) with shared `DeliveryProvider`, bottom tab nav (4 tabs) and horizontal swipe navigation (`react-swipeable`):

```
┌─ /delivery (tab "Início")
│    Menu + cart → stack interno (login → address → checkout) → redirect /delivery/pedidos/[id]
├─ /delivery/pedidos (tab "Pedidos")
│    Lista de pedidos · filtro Todos/Em andamento/Concluídos · pull-to-refresh · skeleton
│    └─ /delivery/pedidos/[id] (detalhes) → reaproveita OrderTrackingView (inline=true)
├─ /delivery/enderecos (tab "Endereços")
│    Lista + modal novo endereço (lookup CEP via ViaCEP + auto-geocode no POST)
└─ /delivery/perfil (tab "Perfil")
     Se logado: avatar + nome + atalhos + logout. Se não: fluxo OTP (phone → code → name opcional)
```

**Elementos nativos implementados:**
- Bottom tab bar fixo com `env(safe-area-inset-bottom)` para iOS notch; ícone ativo em orange-500 com underline top
- Badge no tab "Pedidos" com contagem de pedidos ativos (`received/accepted/preparing/ready/dispatched`), atualizado via polling 30s no `DeliveryProvider`
- Swipe horizontal entre tabs: desabilitado em sub-rotas (ex: `/delivery/pedidos/[id]`) via `TAB_ORDER.indexOf(pathname) !== -1`
- Pull-to-refresh manual (sem lib) em `/delivery/pedidos` via `onTouchStart/Move/End` — recarrega `reloadOrders()` quando dist>60px
- Sticky header por tab com saudação "Olá, João" (tab Início) ou título da tab
- Skeleton loading (`Skeleton.tsx` — Card/List) substitui texto "Carregando..." nas listas
- Cookie `md_customer` (60d) faz session persistir; todas as tabs chamam `/auth/me` via Context e mostram conteúdo logado automaticamente

The landing page `/` offers two entry points: "Escanear Mesa" (in-restaurant QR dine-in) and "Pedir Delivery" (`/delivery`). The delivery button only appears when `deliveryEnabled || takeoutEnabled` is set on the active Unit.

**Tracking unificado:** O componente `src/components/OrderTrackingView.tsx` é a fonte única de UI de tracking. Usado em 2 lugares:
- `/t/[id]` — página pública compartilhada via WhatsApp (hero com gradient)
- `/delivery/pedidos/[id]` — dentro da tab Pedidos (modo `inline`, sem hero)

Faz polling 15s + socket `driver.location` / `order.status_changed` / `order.updated` na room `order:{id}`.

**Mapa ao vivo (Leaflet + OpenStreetMap):** Quando `status === 'dispatched'`, o tracking renderiza `src/components/LiveDeliveryMap.tsx` com pin do motoboy (🛵), pin de destino (🏠), polyline e auto-fit bounds. Carregado via `next/dynamic({ ssr: false })` para evitar `window is not defined` no SSR. Sem custo — usa tiles OSM gratuitos.

**Geolocalização do motoboy:** O `/driver/page.tsx` usa `navigator.geolocation.watchPosition` (high accuracy) enquanto existe pedido `dispatched`, com throttle de 10s, enviando para `PUT /api/v1/driver/location`. O backend emite `driver.location` na room `order:{id}` para que o cliente veja o pin se mover em tempo real.

**Tema claro escopado:** O `body` global usa `color: #ededf3` (dark para admin). Para o app delivery funcionar com cartões brancos e texto legível, o `@/Users/admin/Documents/Projetos/mesa_digital/src/app/delivery/layout.tsx` aplica `bg-gray-50 text-gray-800` no wrapper raiz, sobrescrevendo a herança. Qualquer `<h1>`, `<h2>`, `<label>`, `<textarea>` sem classe explícita fica cinza escuro. Elementos com classe (`text-gray-500`, `text-orange-600`) continuam intocados.

**Push Notifications (Web Push / VAPID):**
- **Schema:** `Unit.pushVapidPublicKey/PrivateKey/Subject` + tabela `PushSubscription(endpoint @unique, p256dh, auth, customerId?)` → `@/Users/admin/Documents/Projetos/mesa_digital/prisma/schema.prisma`
- **Gerador de chaves:** admin acessa Delivery → config → card "Notificações Push (VAPID)" e gera com 1 clique (`POST /api/v1/admin/delivery/push-config`) OU cola manualmente (`PATCH`). Private key é write-only.
- **Cliente:** `@/Users/admin/Documents/Projetos/mesa_digital/src/app/delivery/_lib/push.ts` — registra service worker `/sw-push.js`, pede permissão e subscribe via `PushManager`. Componente `PushToggle` aparece na tab Perfil só quando (a) browser suporta e (b) loja configurou VAPID.
- **Service Worker:** `public/sw-push.js` — trata `push` (mostra Notification) e `notificationclick` (abre/foca `/delivery/pedidos/[id]`).
- **Disparo:** `src/lib/delivery/status.ts` chama `notifyCustomerPush(order)` após emitir sockets; templates por status em `statusPushTemplates`. Endpoints 404/410 são removidos automaticamente.
- **Endpoints:** `GET /api/v1/delivery/push/config` (public key), `POST /subscribe` (customer auth), `POST /unsubscribe` (sem auth), `GET/PATCH/POST /api/v1/admin/delivery/push-config` (admin).
- **Migração:** `prisma/migrations/manual/push_notifications.sql` — rodar na VPS ao aplicar (ou `prisma db push`).

### Key files

| File | Purpose |
|------|---------|
| `src/lib/delivery/otp.ts` | OTP generation, rate-limit (3/10min), verification (3 attempts, 5min TTL) |
| `src/lib/delivery/geocoding.ts` | Google Maps Geocoding API + DB cache (30d TTL) + ViaCEP fallback |
| `src/lib/delivery/pricing.ts` | Haversine distance + fee calculation + free-over threshold + out-of-range check |
| `src/lib/delivery/virtual-table.ts` | Get/create virtual table #9998 + per-order virtual session |
| `src/lib/delivery/orders.ts` | `createDeliveryOrder` — validates stock, calculates fee, creates `Order(channel='delivery')`, emits to KDS, triggers WhatsApp confirmation |
| `src/lib/delivery/status.ts` | `updateDeliveryOrderStatus` — single source of truth for status transitions (used by admin + driver routes). Dispara sockets + WhatsApp + push |
| `src/lib/delivery/push.ts` | `sendPushToCustomer`, `generateVapidKeys`, `statusPushTemplates`. Usa lib `web-push`. Remove automaticamente subscriptions com endpoint 410/404 |
| `src/app/delivery/_lib/context.tsx` | React Context orchestrating cart, customer, step navigation + integração com `history.pushState/popstate` para back button do mobile |
| `src/app/delivery/_lib/api.ts` | Client wrapper; `extractError()` normalizes `{error: {message, details}}` responses into plain strings to avoid React #31 |
| `src/app/delivery/_lib/push.ts` | Registra service worker `/sw-push.js`, pede permissão, subscribe via `PushManager`, envia ao backend. Converte VAPID base64url → Uint8Array |
| `src/app/delivery/_components/*` | Shared: `BottomNav`, `Skeleton`, `PushToggle`. Stack da tab Início: `MenuStep` (scroll-spy via IntersectionObserver), `CartDrawer`, `LoginStep`, `AddressStep` (pré-check quote com badges de raio), `CheckoutStep` |
| `src/app/delivery/{pedidos,enderecos,perfil}/page.tsx` | Páginas das tabs (cada uma consome `useDelivery()` do Provider no layout) |
| `src/app/admin/delivery/_components/PushConfigCard.tsx` | UI admin para gerar/colar chaves VAPID com 1 clique, com contagem de devices inscritos |
| `src/app/admin/orders/page.tsx` | **Página unificada de pedidos** — filtros por canal (Mesa/Delivery/iFood) com contadores, filtro de status, busca, cards expansíveis com endereço, entregador, pagamento, link Google Maps |
| `src/components/OrderTrackingView.tsx` | Componente unificado de tracking (usado por `/t/[id]` público e `/delivery/pedidos/[id]` interno via prop `inline`). Inclui `LiveDeliveryMap` quando status=dispatched |
| `src/components/LiveDeliveryMap.tsx` | Mapa Leaflet + OpenStreetMap (carregado via `next/dynamic({ ssr: false })`). Pins 🛵/🏠, polyline, auto-fit bounds. Custo zero |
| `public/sw-push.js` | Service worker registrado em `/delivery` scope. Trata eventos `push` (mostra Notification) e `notificationclick` (navega/foca `/delivery/pedidos/[id]`) |

### Customer API routes (`/api/v1/delivery/`)

All endpoints resolve the active Unit server-side — the client never passes a slug.

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /info` | none | Public unit metadata (name, logo, delivery config, open status) |
| `GET /menu` | none | Public catalog filtered to active products |
| `POST /auth/request-otp` | none | Send 6-digit OTP via WhatsApp (body: `{ phone }`) |
| `POST /auth/verify-otp` | none | Validate code, upsert `Customer`, set `md_customer` cookie (body: `{ phone, code, name? }`) |
| `GET /auth/me` | optional | Returns `{customer: null}` (200) for visitors, `{customer: {...}}` for logged-in. Never 401 — avoids noisy console errors |
| `POST /auth/me` | customer | Logout (clears cookie) |
| `POST /quote` | none | Fee + ETA for a given address or lat/lng |
| `GET /zipcode/[cep]` | none | ViaCEP proxy (free, no quota) |
| `GET/POST /addresses` | customer | List / create addresses (auto-geocodes on create) |
| `DELETE /addresses/[id]` | customer | Delete address |
| `GET/POST /orders` | customer | List customer orders / create new order |
| `GET /orders/[id]` | none (guess-resistant cuid) | Tracking details (also used by public `/t/[id]`); driver lat/lng only included when status is `dispatched` |
| `GET /push/config` | none | Retorna VAPID public key da unit ativa (`{enabled, publicKey}`). Consumido pelo `PushToggle` |
| `POST /push/subscribe` | customer | Registra/upsert uma `PushSubscription` (por endpoint) |
| `POST /push/unsubscribe` | none | Remove subscription pelo endpoint (sem auth para permitir cleanup quando o browser revoga) |

### Admin API routes (`/api/v1/admin/`)

| Route | Role | Purpose |
|-------|------|---------|
| `GET /orders?status=<status\|all>&channel=<dine-in\|delivery\|ifood\|all>&limit=N` | any staff | **Unified orders list** — retorna campos enriquecidos (channel, orderType, deliveryAddress, deliveryLat/Lng, distanceKm, driver, paymentMethod/Status, deliveryFee, customerName/Phone). Normaliza `Decimal → number`. Usado pela página `/admin/orders` redesenhada |
| `GET/PATCH /delivery` | admin/manager | Unit delivery config (origin coords, Google key, rates, radius) — no slug field |
| `GET /delivery/orders` | staff | List delivery orders (filter by status) + counts by status |
| `POST /delivery/orders/[id]/status` | staff | Change status (triggers WhatsApp + **push** notification to customer) |
| `POST /delivery/orders/[id]/assign-driver` | staff | Assign/unassign motoboy. Emits `order.assigned`/`order.unassigned` to the driver room so the motoboy app updates instantly |
| `GET/POST /drivers` | admin/manager | List / create motoboys (with bcrypt-hashed PIN, optional commission settings) |
| `PATCH/DELETE /drivers/[id]` | admin/manager | Update / soft-delete motoboy (preserves history) |
| `GET/PATCH/POST /delivery/push-config` | admin/manager | Gerenciar VAPID keys da unit (GET retorna public+subject+contagem de subs, PATCH salva chaves manuais, POST gera par novo) |

### Error response shape

All API handlers go through `src/lib/api.ts`. Failures return `{ error: { message, details? } }` with the appropriate status. The delivery client (`src/app/delivery/_lib/api.ts`) normalizes this into a plain string via `extractError()` before passing to `setError()` — **do not call `setError(res.error)` with raw body**, it'll crash React with error #31.

### Decimal serialization (IMPORTANT)

Prisma serializa colunas `Decimal` como **string** no JSON. Qualquer endpoint que retorne `total`, `subtotal`, `deliveryFee`, `distanceKm`, `unitPrice`, `totalPrice`, `changeFor`, `deliveryLat/Lng` etc. **deve normalizar com `Number(x)` antes de retornar** — senão chamadas client-side como `.toFixed()` ou `.toLocaleString()` com options crasham o app inteiro. Padrão já aplicado em `/api/v1/admin/orders`, `/api/v1/admin/delivery/orders`, `/api/v1/driver/orders`. Ao criar novos endpoints que exponham `Order`, siga o mesmo pattern (ou reaproveite um helper `serializeOrder` compartilhado).

### Página `/admin/orders` (unificada)

Única interface para **todos** os pedidos (mesa, delivery, iFood). Substitui a antiga lista simples.
- **Filtros:** chips por canal com contadores ativos em tempo real + pills de status (Em andamento/Recebidos/Confirmados/Em preparo/Prontos/Saíram/Entregues/Todos) + busca global (#número, nome, telefone, endereço)
- **Cards:** badge de canal colorido, badge de status, cliente, telefone, endereço truncado + entregador quando delivery. Ao expandir mostra itens, pagamento, endereço completo com link Google Maps, WhatsApp/tel links, observações
- **Atribuição de motoboy:** dropdown inline só aparece para `orderType=delivery` em status `accepted..dispatched`. Mensagem com link `/admin/drivers` se não houver nenhum cadastrado
- **Transições de status contextuais:** o botão "→ próximo" escolhe o endpoint certo conforme canal — `delivery`/`ifood` → `/api/v1/admin/delivery/orders/[id]/status` (dispara push + WhatsApp); `dine-in` → `/api/v1/kitchen/orders/[id]/status`. Fluxos distintos: dine-in termina `ready→delivered`; delivery tem `ready→dispatched→delivered`
- **Realtime:** socket em `order.created|updated|status_changed` recarrega a lista; polling 20s como fallback
- **Robustez:** fallback defensivo para `channel` desconhecido (evita `TypeError` em pedidos legados sem o campo)

### Fee calculation

`calculateDeliveryFee(unitId, customerLat, customerLng, orderSubtotal?)`:

```
distanceKm = haversine(unit.addressLat/Lng, customerLat/Lng)
fee = deliveryBaseFee + (distanceKm × deliveryFeePerKm)
if orderSubtotal >= deliveryFreeOver → fee = 0
if distanceKm > deliveryMaxRadiusKm → outOfRange = true
estimatedMinutes = deliveryPrepTimeMin + deliveryAvgTimeMin
```

### Virtual entities

Each delivery order gets:
- Shared virtual `TableEntity` (number `9998`, `virtual=true`, one per Unit, lazy-created)
- Dedicated virtual `TableSession` (one per order, holds `customerId`, `customerName`, `customerPhone`)
- Regular `Order` row with `channel='delivery'`, `orderType='delivery'|'takeout'`, `customerId`, `driverId`, `deliveryFee`, `distanceKm`, etc.

This preserves all existing invariants (`Order.tableId` and `Order.sessionId` are always non-null).

### WhatsApp status notifications

Triggered from `/api/v1/admin/delivery/orders/[id]/status` — fire-and-forget `notifyCustomerStatus(order)`. Each status has its own emoji + message template. `cancelled` additionally closes the virtual session.

### Rate limits & security

- OTP: max 3 active codes per phone per 10min window, 3 failed attempts per code
- Customer JWT: httpOnly `md_customer` cookie (60d) — distinct from staff token (localStorage Bearer) to reduce XSS blast radius
- Public order tracking (`/t/[id]`): accepts any cuid (non-guessable), no leak of customer phone/email — only name is shown
- Geocoding cache: per-unit, keyed by SHA1 of normalized address, 30d TTL

### Setup checklist (per unit)

1. `/admin/delivery` → set origin `addressLat` + `addressLng` (link in UI opens Google Maps). **These must match the real restaurant location** — the haversine distance check uses them, and wrong coords cause legitimate orders to return `400 "fora da área"`
2. Paste `googleMapsApiKey` (Geocoding API enabled)
3. Configure rates (`deliveryBaseFee`, `deliveryFeePerKm`, `deliveryMaxRadiusKm`, `deliveryMinOrder`, optional `deliveryFreeOver`)
4. Set prep/avg times
5. Toggle `deliveryEnabled` and/or `takeoutEnabled`
6. `/admin/whatsapp` → connect WhatsApp (OTP + notifications require it)
7. `/admin/drivers` → add motoboys with PIN (and optional commission)

### Driver (Motoboy) area

Simple PWA-like area for delivery drivers. Login with phone + PIN (no WhatsApp OTP here — PIN is set by admin when creating the driver).

**Pages:**
- `/driver/login` — phone + PIN form, checks session first and redirects to `/driver` if already logged in
- `/driver` — dashboard with two tabs (Active / History). Socket-driven (joins `driver:{driverId}` room); 60s polling is a fallback. Audio beep + browser notification on new assignments. "Despachar todos" button when 2+ ready orders. Google Maps directions link, WhatsApp/phone links, item details
- `/driver/stats` — today/week/month summary: count, km rodados, ticket médio, receita, and calculated commission. Also shows the driver's commission config

**Real-time geolocation:**
While the driver has at least one `dispatched` order, the `/driver` page runs `navigator.geolocation.watchPosition` with a 10s throttle and PUTs `/api/v1/driver/location` with `{lat, lng}`. The endpoint writes `Driver.currentLat/Lng/lastLocationAt` and emits `driver.location` to each active `order:{id}` room. The public tracking page `/t/[id]` listens for that event and shows "Motoboy a X km de você" + a stale indicator + a Google Maps directions link. Location is only exposed to the customer while the order is `dispatched`.

**API routes (`/api/v1/driver/`):**

| Route | Purpose |
|-------|---------|
| `POST /auth/login` | Validates phone + PIN via bcrypt, issues `md_driver` cookie (30d), updates `Driver.lastLoginAt` |
| `GET /auth/me` | Returns current driver profile |
| `POST /auth/me` | Logout (clears cookie) |
| `GET /orders?status=active\|history` | Lists orders where `driverId=me`. Active = `ready+dispatched`; History = last 30 `delivered+cancelled` |
| `POST /orders/[id]/status` | Driver-only transitions: `ready→dispatched` and `dispatched→delivered`. Validates ownership via `driverId`. Uses shared `updateDeliveryOrderStatus` helper |
| `PUT /location` | Update driver's live GPS. Writes to `Driver` and emits `driver.location` to every `order:{id}` room the driver currently has `dispatched` |
| `GET /stats` | Summaries for today/week/month + commission config |

**Status transition rules (enforced server-side):**
- Driver can only act on orders where `driverId === me`
- `dispatched` requires current status `ready`
- `delivered` requires current status `dispatched`
- Any other transition returns 400

**Commission model:**
Each `Driver` can have `commissionPerDelivery` (fixed R$) and/or `commissionPercent` (% of `deliveryFee`). Both can coexist — the stats page sums them. Config is set in `/admin/drivers` on create or edit. Fields are optional (null → no commission).

**Shared helper `src/lib/delivery/status.ts`:**
`updateDeliveryOrderStatus({ orderId, status, reason?, expectedUnitId? })` — single source of truth for status changes. Used by both `/api/v1/admin/delivery/orders/[id]/status` and `/api/v1/driver/orders/[id]/status`. Handles timestamps, driver stats increment, virtual session closing (when cancelled), socket emits, and WhatsApp customer notification.

### Online payment (planned)

UI already exposes `'online'` method but backend is stubbed. To finish:
1. Unit already has `mpAccessToken` / `asaasApiKey` / `asaasWebhookToken` fields
2. On `createDeliveryOrder` with `paymentMethod='online'`, call gateway (PIX QR or cart link), store `paymentExternalId`, keep `status='received'` + `paymentStatus='pending'`
3. Webhook at `/api/v1/webhooks/asaas` or `/mp` validates signature, sets `paymentStatus='paid'`, **then** emits to KDS (similar to offline flow)
4. UI: show QR code + "awaiting payment" until webhook completes

---

## Mobile APKs (Capacitor)

Each role ships as a thin Capacitor wrapper that loads the production URL inside a WebView. No JS is bundled in the APK — all updates ship via web deploy.

### Projects under `mobile/`

| Folder | `appId` | Points to | Notes |
|--------|---------|-----------|-------|
| `mobile/admin` | `site.espetinhodochef.admin` | `/admin` | Backoffice |
| `mobile/waiter` | `site.espetinhodochef.waiter` | `/waiter` | Garçom |
| `mobile/driver` | `site.espetinhodochef.driver` | `/driver` | Motoboy (requires GPS permission at runtime for live location) |
| `mobile/customer` | `site.espetinhodochef.customer` | `/` | Cliente (landing with QR scan + delivery buttons). Manifest declares `CAMERA` permission for the QR scanner |

### Build flow

Each project has `capacitor.config.ts` (with `server.url` pointing to production), a minimal `www/index.html` (never loaded in practice), and a signed Android project in `android/`.

```bash
cd mobile/<role> && npx cap sync android && cd android && ./gradlew assembleRelease
# APK output: android/app/build/outputs/apk/release/app-release.apk
```

All four APKs share the same keystore (copied from `mobile/admin/android/app/admin-key.jks`), with alias `admin-key` and password `MesaDigital@2025`. Each project renames the keystore file locally (`driver-key.jks`, `customer-key.jks`, etc.) but the alias/password stay the same so updates keep the same package signature.

**To add a new role APK:** copy an existing folder, edit `appId`/`appName`/`server.url` in `capacitor.config.ts` and `applicationId`/`namespace` in `android/app/build.gradle`, run `npm install` + `npx cap add android`, copy the keystore, configure `signingConfigs.release`, then build.
