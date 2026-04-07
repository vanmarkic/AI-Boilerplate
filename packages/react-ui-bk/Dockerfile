# Stage 1: Build Storybook
FROM node:22-slim AS build
WORKDIR /app

COPY package.json ./
COPY packages/design-system/package.json ./packages/design-system/
COPY packages/react-headless/package.json ./packages/react-headless/
COPY packages/react-ui/package.json ./packages/react-ui/

RUN npm install --workspace=packages/react-ui

COPY packages/design-system/ ./packages/design-system/
COPY packages/react-headless/ ./packages/react-headless/
COPY packages/react-ui/ ./packages/react-ui/

RUN npm run build --workspace=packages/react-headless
RUN npm run build-storybook --workspace=packages/react-ui

# Stage 2: Serve with nginx
FROM nginx:1.27-alpine

COPY --from=build /app/packages/react-ui/storybook-static /usr/share/nginx/html

EXPOSE 80
