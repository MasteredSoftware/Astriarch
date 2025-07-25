FROM node:18-alpine AS build

WORKDIR /usr/src/app

# Install pnpm globally
RUN npm install -g pnpm

# Copy source code
COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm run --filter=astriarch-backend... build

RUN pnpm deploy --filter=astriarch-backend --prod /prod/astriarch-backend

FROM node:18-alpine AS backend

COPY --from=build /prod/astriarch-backend /prod/astriarch-backend
WORKDIR /prod/astriarch-backend

# Expose port
EXPOSE 8001

# Start the application
CMD ["pnpm", "start"]
