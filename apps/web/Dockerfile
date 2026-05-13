FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json ./
COPY tsconfig.json next.config.js tailwind.config.ts postcss.config.js ./
RUN pnpm install --prod=false
COPY app ./app
COPY components ./components
COPY lib ./lib
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
