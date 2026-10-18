FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --include=dev --include=optional --no-audit --no-fund
COPY . .
RUN node scripts/build-railway.mjs

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8787 PRODUCT_BASE_DOMAIN=grokify.fun PRODUCT_SUBDOMAINS_ENABLED=true
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.railway-next ./.railway-next
COPY --from=build /app/public ./public
COPY --from=build /app/app ./app
COPY --from=build /app/railway ./railway
COPY --from=build /app/scripts/revenue-runner.mjs ./scripts/revenue-runner.mjs
COPY --from=build /app/scripts/check-integrations.mjs ./scripts/check-integrations.mjs
COPY --from=build /app/scripts/prepare-funding.mjs ./scripts/prepare-funding.mjs
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json /app/next.config.ts ./
EXPOSE 8787
CMD ["node", "railway/server.mjs"]
