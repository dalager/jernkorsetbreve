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
ARG NEXT_PUBLIC_GIT_SHA=dev
ARG NEXT_PUBLIC_BUILD_DATE=dev
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_GIT_SHA=${NEXT_PUBLIC_GIT_SHA}
ENV NEXT_PUBLIC_BUILD_DATE=${NEXT_PUBLIC_BUILD_DATE}

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Expose port
EXPOSE 3000

# Development mode with turbopack
CMD ["npm", "run", "dev"]
