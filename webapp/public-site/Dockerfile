# Jernkorset Public Site - Next.js
# Server-side rendered public website

FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument for API URL
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Expose port
EXPOSE 3000

# Development mode with turbopack
CMD ["npm", "run", "dev"]
