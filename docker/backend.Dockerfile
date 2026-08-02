# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package descriptors
COPY backend/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy source code
COPY backend/ ./

# Expose server port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "server.js"]
