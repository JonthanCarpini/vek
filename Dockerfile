FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.js ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.js ./
RUN mkdir -p /app/public/uploads
EXPOSE 3000
CMD ["sh", "-c", "(npx prisma migrate deploy 2>/dev/null || npx prisma db push --skip-generate --accept-data-loss) && node server.js"]
