# Taken from https://pnpm.io/docker#example-1-build-a-bundle-in-a-docker-container
# with some small modifications.
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM node:22-alpine
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=base /app/ /app/
EXPOSE 4443
CMD [ "node", "/app/index.js" ]
