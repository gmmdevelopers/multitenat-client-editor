# syntax=docker/dockerfile:1
#
# Dockerfile del panel (client-editor).
#
# ## Este repo es el contexto de build
#
# `client-editor` es su **propio repositorio git**, asi que Docker solo ve esta
# carpeta. Nada de `../packages/` existe en el build: el design system y los
# tokens se instalan **desde GitHub**.
#
# ## Las dos dependencias de git son privadas
#
# `github:gmmdevelopers/multitenant-design-system` y
# `github:gmmdevelopers/multitenants-tokens` necesitan un `GITHUB_TOKEN` con
# permiso de lectura. Llega como build arg desde Coolify y nunca se escribe en el
# repo.

# ---------- Etapa de build ----------
FROM node:24-slim AS builder

WORKDIR /app

# `ca-certificates` es imprescindible: `node:24-slim` no trae los certificados
# raiz, y sin ellos git no puede verificar el HTTPS de GitHub al clonar los
# paquetes (falla con "server certificate verification failed").
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Autentica cualquier clonado de GitHub durante `pnpm install`.
ARG GITHUB_TOKEN
RUN if [ -n "$GITHUB_TOKEN" ]; then \
      git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"; \
    fi

# ## La version de pnpm NO es un detalle
#
# Tiene que coincidir con la del `packageManager` del `package.json` y con la que
# genero el lockfile en local. Con pnpm 9 (lo que habia antes) el
# `pnpm-workspace.yaml` no se entiende: usa `allowBuilds`, una clave que esa
# version no conoce (la suya es `onlyBuiltDependencies`).
RUN corepack enable && corepack prepare pnpm@11 --activate

# ## Se copia el codigo ANTES de instalar
#
# El orden importa por un motivo concreto: `pnpm-workspace.yaml` viene del repo
# con el override de DESARROLLO
#
#     "@multitenant/design-system": "link:../packages/design-system"
#
# y hay que limpiarlo **despues** de copiarlo. Al reves, `COPY . .` lo
# sobrescribia con la version sucia y el trabajo del `sed` se perdia entero.
#
# El sintoma de aquello no apuntaba a la causa: el `install` pasaba y el fallo
# aparecia al compilar, con `<- ../packages/design-system` y un aviso de
# "non-existent directory".
#
# El coste: un cambio de codigo invalida tambien la capa de instalacion. Se
# acepta porque el workspace depende del codigo, no al reves.
COPY . .

# ## Limpieza del workspace: dos cosas
#
# ### 1. Quitar el `overrides` de desarrollo
#
# El `link:` apunta a una carpeta que en Docker no existe. pnpm lo instala como
# enlace muerto **sin dar error**, y el design system queda sin instalar: el build
# falla despues con "Cannot find module".
#
# El corte empieza en el **comentario** que abre el bloque, no en `overrides:`.
# Cortando desde ahi, ese comentario se queda colgando y las lineas que se añaden
# despues caen **dentro de un comentario**: el YAML sigue valido, asi que no hay
# error — simplemente el allowlist no existe y el fallo se repite igual.
#
# ### 2. Autorizar los scripts de los paquetes de git
#
# pnpm 11 los **ignora** salvo autorizacion, y avisa sin cortar el install:
#
#     [ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @multitenant/design-system@git+...
#
# El design system necesita su `prepare`: es lo que genera `src/block-index.ts`.
#
# La clave es la **spec completa del git**, no el nombre del paquete. Si se cambia
# la URL del repo, hay que cambiar estas dos lineas.
#
# Se añade a lo que ya trae el archivo (`unrs-resolver`, `esbuild`) en vez de
# reescribirlo: esos dos los necesita Next.
RUN sed -i '/^# --- Design system: LOCAL en desarrollo/,$d' pnpm-workspace.yaml \
    && printf '  "@multitenant/design-system@git+https://github.com/gmmdevelopers/multitenant-design-system.git": true\n  "@multitenant/tokens@git+https://github.com/gmmdevelopers/multitenants-tokens.git": true\n' >> pnpm-workspace.yaml \
    && echo '--- pnpm-workspace.yaml que se usa en el build:' \
    && cat pnpm-workspace.yaml

# Sin `--frozen-lockfile`: el lockfile esta en `.dockerignore` porque lleva el
# `link:` incrustado. La version de cada paquete la fija el `package.json`.
RUN pnpm install

# Las variables NEXT_PUBLIC_* se incrustan en el bundle en tiempo de BUILD, por
# eso llegan como args y no como env de runtime.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_DOMAIN
ARG RESEND_API_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_DOMAIN=$NEXT_PUBLIC_APP_DOMAIN
ENV RESEND_API_KEY=$RESEND_API_KEY

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
# CRITICO: el `server.js` de Next escucha en `process.env.HOSTNAME` si existe, y
# Docker define HOSTNAME con el ID del contenedor. Sin esto, Next queda escuchando
# en un hostname interno inalcanzable desde Caddy y el dominio da 502.
ENV HOSTNAME=0.0.0.0
# Coolify inyecta PORT; el default de Next standalone es 3000.
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
