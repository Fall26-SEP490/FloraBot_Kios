FROM node:24-bookworm-slim AS build
WORKDIR /workspace
RUN npm install --global pnpm@11.10.0
COPY . .
RUN pnpm install --frozen-lockfile
RUN VITE_BASE_PATH=/kiosk/ pnpm build

FROM caddy:2-alpine
COPY --from=build /workspace/apps/kiosk/dist /srv/kiosk
COPY Caddyfile /etc/caddy/Caddyfile
