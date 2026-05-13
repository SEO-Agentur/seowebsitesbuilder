# Pre-built template image — bakes node_modules in so first start is <2s
# instead of 15-30s. Build with:
#   docker build -t seo-tpl-astro:latest -f packages/templates/astro/Dockerfile packages/templates/astro
#
# At runtime the orchestrator bind-mounts the user's project dir to /app and
# mounts an anonymous volume on /app/node_modules to preserve this image's
# node_modules from being shadowed by the bind.
FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json ./
RUN pnpm install --silent
EXPOSE 3000
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "3000"]
