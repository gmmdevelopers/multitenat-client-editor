# syntax=docker/dockerfile:1
#
# Dockerfile del cliente (panel + web publica).
#
# Particularidad: el design system vive en un repo PRIVADO
# (`github:gmmdevelopers/multitenant-design-system`), asi que el build necesita
# un token de GitHub con permiso de lectura. Llega como build arg desde Coolify
# y NUNCA se escribe en el repo.

# ---------- Etapa de build ----------
FROM node:24-slim AS builder

WORKDIR /app

# openssl lo usan algunas dependencias nativas.
RUN apt-get update && apt-get install -y --no-install-recommends openssl git \
    && rm -rf /var/lib/apt/lists/*

# El token llega por build arg. Con esto, cualquier clonado de GitHub durante
# `pnpm install` (incluido el del design system) queda autenticado.
ARG GITHUB_TOKEN
RUN if [ -n "$GITHUB_TOKEN" ]; then \
      git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"; \
    fi

COPY package.json pnpm-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@9 --activate

# Sin el lockfile congelado, una actualizacion del DS podria cambiar el arbol de
# dependencias sin que nadie lo revise.
RUN pnpm install --frozen-lockfile

COPY . .

# Las variables NEXT_PUBLIC_* se incrustan en el bundle en tiempo de BUILD, por
# eso llegan como args y no como env de runtime.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_DOMAIN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_DOMAIN=$NEXT_PUBLIC_APP_DOMAIN

# El design system viene como TypeScript sin compilar; Next lo transpila gracias
# a `transpilePackages` en next.config.ts.
RUN pnpm run build

# ---------- Etapa de runtime ----------
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# `output: standalone` deja un servidor minimo con solo las dependencias que la
# app usa en runtime. Por eso no copiamos node_modules completo.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Next escucha en PORT (Coolify lo inyecta).
EXPOSE 3000

CMD ["node", "server.js"]
