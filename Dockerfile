FROM oven/bun:1.4.4-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json bun.lockb* ./
RUN bun install --production

# Copy source code
COPY . .

# Run migrations and start the application
CMD ["bun", "run", "src/main.ts"]

EXPOSE 3000
