# Jernkorset Frontend - React Dashboard (Development)
# Vite dev server with hot module replacement

FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument for API URL (defaults to empty, code will use /api proxy)
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server with host flag for Docker networking
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
