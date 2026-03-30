# MBOM Backend Dockerfile
FROM node:22-alpine AS builder

# Install OpenSSL and build dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat openssl-dev

WORKDIR /app

# Copy backend files (including tsconfig.json)
COPY backend/package*.json ./backend/
COPY backend/tsconfig.json ./backend/
COPY backend/prisma ./backend/prisma/

WORKDIR /app/backend
RUN npm ci && npx prisma generate && npm run build

# Copy frontend files
COPY frontend/package*.json ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY frontend/tsconfig*.json ./frontend/
COPY frontend/index.html ./frontend/
COPY frontend/src ./frontend/src/
WORKDIR /app/frontend
RUN npm ci && npm run build

# Production stage
FROM node:22-alpine AS production

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev && cd ..

# Copy built artifacts
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "cd backend && node dist/app.js"]
