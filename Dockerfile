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

# `ca-certificates` es imprescindible: `node:24-slim` no trae los certificados
# raiz, y sin ellos git no puede verificar el HTTPS de GitHub al clonar el
# design system (falla con "server certificate verification failed").
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# El token llega por build arg. Con esto, cualquier clonado de GitHub durante
# `pnpm install` (incluido el del design system) queda autenticado.
ARG GITHUB_TOKEN
RUN if [ -n "$GITHUB_TOKEN" ]; then \
      git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"; \
    fi

# Solo el `package.json`.
#
# El `pnpm-lock.yaml` esta en `.dockerignore` porque lleva incrustado el override
# de DESARROLLO del design system (`link:../packages/design-system`), y en Docker
# esa carpeta no existe. Copiarlo aqui daria:
#
#     ERROR: failed to calculate checksum ... "/pnpm-lock.yaml": not found
#
# Sin lockfile, la version del design system la fija el `package.json`
# (`github:gmmdevelopers/multitenant-design-system#main`).
COPY package.json ./

# ## La version de pnpm NO es un detalle
#
# Tiene que coincidir con la que genero el `pnpm-lock.yaml` en local, y con la
# del `packageManager` del `package.json`: si no, el arbol de dependencias del
# contenedor y el de la maquina de nadie coinciden, y el bug aparece solo en
# produccion.
#
# Antes aqui se activaba pnpm 9 y los archivos venian de pnpm 11.
# `pnpm-workspace.yaml` usa `allowBuilds`, una clave que pnpm 9 no conoce (la suya
# es `onlyBuiltDependencies`), y el `install` fallaba con
# `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
#
# Al actualizar pnpm en local, actualiza esta linea y el `packageManager` del
# `package.json`.
RUN corepack enable && corepack prepare pnpm@11 --activate

# ## Los tokens vienen de GitHub, no del monorepo
#
# El editor declaraba:
#
#     "@multitenant/tokens": "file:../packages/tokens"
#
# Una ruta del monorepo. **Este proyecto es su propio repo git**, asi que el
# contexto de Docker es `client-editor/` y `../packages/` no existe: pnpm fallaba
# al instalar con
#
#     ENOENT: no such file or directory, scandir '/packages/tokens'
#
# Ahora apunta a su repo (`github:gmmdevelopers/multitenants-tokens#main`), que
# pnpm descarga como cualquier otra dependencia. `GITHUB_TOKEN` ya autentica el
# clonado para el design system, asi que sirve para los dos.

# ## El workspace entra SIN el override del design system
#
# `pnpm-workspace.yaml` del editor declara:
#
#     overrides:
#       "@multitenant/design-system": "link:../packages/design-system"
#
# Ese `link:` es solo para desarrollo. En Docker no hay monorepo, asi que apunta
# a una carpeta que no existe y el paquete queda **sin instalar** — sin error, y
# el build falla despues con un sintoma que no lo explica.
#
# Se copia el archivo y se le QUITA el bloque `overrides`. Se conserva el resto
# (`allowBuilds`), que es lo que autoriza los scripts de compilacion.
#
# Sin `--frozen-lockfile` porque el lockfile no se copia: lleva el `link:`
# incrustado. La version del design system la fija el `package.json`
# (`github:...#main`).
COPY pnpm-workspace.yaml ./

# Se quita el bloque `overrides` (ver arriba) y se AUTORIZAN los scripts de los
# dos paquetes que se instalan desde git.
#
# ## Por que hace falta autorizarlos aqui
#
# pnpm 11 bloquea los scripts de paquetes de git salvo que esten en
# `allowBuilds`, con un error explicito:
#
#     ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED
#     The git-hosted package "@multitenant/design-system@0.1.0" needs to execute
#     build scripts but is not in the "allowBuilds" allowlist.
#
# El design system **necesita** correr su `prepare`: es lo que genera
# `src/block-index.ts`, sin el cual el build falla con "Cannot find module".
#
# ## La clave es la SPEC del git, no el nombre
#
# Con el nombre a secas (`"@multitenant/design-system": true`) el error sigue.
# Los paquetes de git se identifican por su spec completa. Si se cambia la URL
# del repo, hay que cambiar estas dos lineas.
#
# Se añaden a lo que ya trae el archivo (`unrs-resolver`, `esbuild`) en vez de
# reescribirlo: esos dos los necesita Next.
# ## El corte empieza en el COMENTARIO, no en `overrides:`
#
# El archivo trae antes del `overrides:` un bloque de comentarios que lo
# explica. Cortando desde `overrides:`, ese bloque queda colgando al final y las
# lineas que se añaden despues caen **dentro de un comentario**: el YAML sigue
# siendo valido, asi que no hay error — simplemente las entradas no existen y el
# `install` vuelve a fallar por el allowlist.
#
# Se corta desde la linea que abre ese bloque. Si el comentario cambia, el `sed`
# no encuentra nada y deja el `overrides` dentro: el build fallara con "paquete
# sin instalar", que es un sintoma reconocible.
RUN sed -i '/^# --- Design system: LOCAL en desarrollo/,$d' pnpm-workspace.yaml \
    && printf '  "@multitenant/design-system@git+https://github.com/gmmdevelopers/multitenant-design-system.git": true\n  "@multitenant/tokens@git+https://github.com/gmmdevelopers/multitenants-tokens.git": true\n' >> pnpm-workspace.yaml

RUN pnpm install

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
# CRITICO: el `server.js` de Next escucha en `process.env.HOSTNAME` si existe, y
# Docker define HOSTNAME con el ID del contenedor. Sin esto, Next queda escuchando
# en un hostname interno inalcanzable desde Traefik y el dominio da 502.
ENV HOSTNAME=0.0.0.0
# Coolify inyecta PORT; el default de Next standalone es 3000.
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
