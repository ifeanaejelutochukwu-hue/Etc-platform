FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --silent

COPY . .

# VITE_API_URL is injected at build time via Railway env var
# It should be set to your backend Railway URL, e.g. https://etc-backend.up.railway.app
ARG VITE_API_URL
ARG VITE_LIVEKIT_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_LIVEKIT_URL=$VITE_LIVEKIT_URL

RUN npm run build

# ── Runtime — nginx ────────────────────────────────────────────────────────────
FROM nginx:alpine
RUN apk add --no-cache gettext   # provides envsubst
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80
CMD ["/docker-entrypoint.sh"]
