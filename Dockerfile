FROM node:18-alpine AS builder
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Copy and build
COPY . ./
RUN npm run build
RUN npm prune --production

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000
CMD ["npm", "run", "start"]
