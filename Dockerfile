FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN mkdir -p public && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Payload's migration CLI loads the TypeScript config and migration files at runtime.
# Keep the build dependencies for the CLI; Next's standalone output serves the app.
RUN apk add --no-cache su-exec
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json /app/tsconfig.json /app/payload.config.ts ./
COPY --from=build --chown=node:node /app/collections ./collections
COPY --from=build --chown=node:node /app/globals ./globals
COPY --from=build --chown=node:node /app/migrations ./migrations
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN mkdir -p /app/media && chown node:node /app/media

EXPOSE 3000
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
