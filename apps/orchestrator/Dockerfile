FROM node:20-alpine

# Need git/python for native deps; docker CLI for socket communication.
RUN apk add --no-cache python3 make g++ git docker-cli

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json ./
COPY tsconfig.json ./

# Workspace deps are baked at build time in real prod; here we install fresh.
RUN pnpm install --prod=false

COPY src ./src

RUN pnpm build

EXPOSE 4000

CMD ["node", "dist/index.js"]
