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
| `/public/` | Customer PWA | Session JWT (`x-session-token` header or `md_session` cookie) |
| `/auth/` | All staff | None (returns JWT) |
| `/admin/` | Admin/Manager | Staff JWT (`Authorization: Bearer` or `md_token` cookie) |
| `/kitchen/` | Kitchen staff | Staff JWT |
| `/waiter/` | Waiter staff | Staff JWT |
| `/cashier/` | Cashier staff | Staff JWT |

RBAC is enforced via `src/lib/guard.ts`. Six roles: `super_admin`, `admin`, `manager`, `waiter`, `kitchen`, `cashier`.

Two JWT secrets must stay separate: `JWT_SECRET` (staff, 30d) and `JWT_SESSION_SECRET` (customer sessions, 4h).

### Frontend pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page with QR scanner |
| `/m/[token]` | Customer PWA (menu, cart, order tracking, calls) |
| `/kds` | Kitchen Display System |
| `/waiter` | Waiter panel (customer call queue) |
| `/cashier` | Session closing & payment |
| `/admin/*` | Backoffice (login, orders, products, categories, tables, users, reports, settings) |
| `/display` | Carousel display for screens |

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
```

After any `schema.prisma` change, run `prisma:generate` then `prisma:migrate`.

Ingredient stock is validated at order creation time in `src/lib/orders.ts`.

### Real-time rooms

Socket.io rooms are scoped per unit to prevent cross-unit data leakage:

| Room | Subscribers |
|------|-------------|
| `unit:{unitId}:kitchen` | KDS panel |
| `unit:{unitId}:waiters` | Waiter panel |
| `unit:{unitId}:dashboard` | Admin dashboard |
| `session:{sessionId}` | Customer PWA |

### Environment variables

Copy `.env.example` for development. Required vars:

```
DATABASE_URL
JWT_SECRET                  # Staff tokens
JWT_SESSION_SECRET          # Customer session tokens
NEXT_PUBLIC_APP_URL         # Must be browser-accessible
NEXT_PUBLIC_SOCKET_URL      # Must be browser-accessible (WebSocket upgrade)
```

`NEXT_PUBLIC_*` vars are bundled into the frontend JS at build time.

### PWA

Multiple PWA manifests (one per panel) configured via `@ducanh2912/next-pwa` in `next.config.js`. Icons and manifests live in `public/`. The `PwaHead` component in `src/components/` handles per-panel install prompts.

### Validation

All API input is validated with Zod schemas defined in `src/lib/validators.ts`. Add new schemas there before creating API routes.

### Path alias

`@/*` resolves to `./src/*` (configured in `tsconfig.json`).
