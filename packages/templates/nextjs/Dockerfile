# Pre-built template image — bakes node_modules in so first start is <2s
# instead of 15-30s. Build with:
#   docker build -t seo-tpl-nextjs:latest -f packages/templates/nextjs/Dockerfile packages/templates/nextjs
FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json ./
RUN pnpm install --silent
EXPOSE 3000
CMD ["pnpm", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
