FROM node:22-slim
WORKDIR /app

# Install workspace root + dependencies
COPY package.json package-lock.json ./
COPY packages/design-system/package.json ./packages/design-system/
COPY packages/ui/package.json ./packages/ui/
COPY packages/tfc-shared/package.json ./packages/tfc-shared/
COPY apps/tfc/frontend/package.json ./apps/tfc/frontend/

RUN npm ci --workspace=apps/tfc/frontend

COPY packages/design-system/ ./packages/design-system/
COPY packages/ui/ ./packages/ui/
COPY packages/tfc-shared/ ./packages/tfc-shared/
COPY apps/tfc/frontend/ ./apps/tfc/frontend/

WORKDIR /app/apps/tfc/frontend

USER node

EXPOSE 4201
CMD ["npx", "ng", "serve", "--host", "0.0.0.0"]
