FROM node:22.23.5-alpine AS base
RUN npm install --global npm@11.19.0 && npm cache clean --force
WORKDIR /app

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN mkdir -p public && npm run build

# Payload's migration CLI is required at startup, but development-only tools are not.
# Payload declares tsx as a production dependency, so TypeScript config/migrations remain loadable.
FROM base AS runtime-dependencies
COPY package*.json ./
RUN npm ci --omit=dev \
    && rm -rf node_modules/@playwright node_modules/playwright node_modules/playwright-core \
    && npm cache clean --force

FROM base AS assembled-runtime
WORKDIR /app

# Payload's migration CLI loads the TypeScript config and migration files at runtime.
# Keep its production dependency tree; Next's standalone output serves the app.
COPY --from=build --chown=node:node /app/package.json /app/tsconfig.json /app/payload.config.ts ./
COPY --from=build --chown=node:node /app/collections ./collections
COPY --from=build --chown=node:node /app/globals ./globals
# Runtime migrations import these through the collection/global configuration.
COPY --from=build --chown=node:node /app/blocks ./blocks
COPY --from=build --chown=node:node /app/components ./components
COPY --from=build --chown=node:node /app/features ./features
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/migrations ./migrations
COPY --from=build --chown=node:node /app/.next/standalone ./
# Tracing used the build tree, which includes development peers. Replace that tree
# wholesale with the complete production install instead of pruning package names.
RUN rm -rf node_modules
COPY --from=runtime-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN mkdir -p /app/media && chown node:node /app/media

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apk add --no-cache su-exec
COPY --from=assembled-runtime --chown=node:node /app /app

EXPOSE 3000
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
