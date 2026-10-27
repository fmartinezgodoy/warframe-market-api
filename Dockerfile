FROM node:26.12.1-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS base
FROM base AS tools
WORKDIR /app
RUN npm install --global pnpm@10.18.3 --ignore-scripts
COPY package.json pnpm-lock.yaml ./
FROM tools AS production
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
FROM tools AS build
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build
FROM base AS runtime
WORKDIR /app
RUN addgroup -g 10001 app && adduser -D -u 10001 -G app app
COPY --from=production /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
ENV NODE_ENV=production HTTP_HOST=0.0.0.0 HTTP_PORT=6002 DATA_SOURCE=fixtures
USER 10001:10001
EXPOSE 6002
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD node -e 'fetch("http://127.0.0.1:" + (process.env.HTTP_PORT || "6002") + "/readyz", {signal: AbortSignal.timeout(2000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'
CMD ["node", "dist/main.js"]
