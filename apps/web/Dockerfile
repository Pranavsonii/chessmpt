# Build context is the repo root:  docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web
COPY apps/web apps/web
# Both values are baked into the bundle / route table at build time.
ARG API_INTERNAL_URL=http://api:4000
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
RUN npm run build -w apps/web

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/web apps/web
WORKDIR /app/apps/web
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
