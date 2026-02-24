FROM node:22-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm install --production=false

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build TypeScript to JavaScript
RUN npx tsc

# Copy SQL migrations (needed at runtime)
COPY src/database/migrations/ ./migrations/

# Remove dev dependencies after build
RUN npm prune --production

# Run the compiled JS
CMD ["node", "dist/index.js"]
