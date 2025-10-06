FROM node:22-alpine AS build

WORKDIR /usr/src/app

# Install specific pnpm version to match local development
RUN npm install -g pnpm@10.11.1

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all package.json files to maintain workspace structure
COPY apps/ apps/
COPY packages/ packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the backend
RUN pnpm run --filter=astriarch-backend... build

RUN pnpm deploy --filter=astriarch-backend --legacy --prod /prod/astriarch-backend

FROM node:22-alpine AS backend

COPY --from=build /prod/astriarch-backend /prod/astriarch-backend
WORKDIR /prod/astriarch-backend

# Expose port
EXPOSE 8001

# Start the application directly with node
CMD ["node", "--enable-source-maps", "dist/app.js"]
