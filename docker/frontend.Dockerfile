# Stage 1: Build the React Application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package descriptors
COPY frontend/package*.json ./

# Install development/production dependencies
RUN npm ci

# Copy source code
COPY frontend/ ./

# Compile Vite React application
RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:alpine

# Copy built files from Stage 1 to Nginx target html path
COPY --from=build /app/dist /usr/share/nginx/html

# Overwrite default Nginx server block config with custom reverse proxy configurations
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
