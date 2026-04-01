# Stage 1: Filter features by tier
FROM node:22-slim AS feature-filter
RUN apt-get update && apt-get install -y python3 python3-pip && pip3 install pyyaml --break-system-packages
ARG TIER=3
COPY packages/monorepo-tier-filter/ /monorepo-tier-filter/
RUN pip3 install /monorepo-tier-filter/ --break-system-packages
COPY shared/scripts/filter-features.py /filter.py
COPY apps/main/frontend/src/app/features/ /all-features/
RUN python3 /filter.py --tier=$TIER --src=/all-features/ --dest=/filtered-features/ --frontend

# Stage 2: Build Angular app
FROM node:22-slim AS build
WORKDIR /app

COPY package.json ./
COPY packages/design-system/package.json ./packages/design-system/
COPY packages/ui/package.json ./packages/ui/
COPY packages/ng-feature-flags/package.json ./packages/ng-feature-flags/
COPY packages/ngrx-with-resource/package.json ./packages/ngrx-with-resource/
COPY apps/main/frontend/package.json ./apps/main/frontend/

RUN npm install --workspace=apps/main/frontend

COPY packages/design-system/ ./packages/design-system/
COPY packages/ui/ ./packages/ui/
COPY packages/ng-feature-flags/ ./packages/ng-feature-flags/
COPY packages/ngrx-with-resource/ ./packages/ngrx-with-resource/
COPY apps/main/frontend/ ./apps/main/frontend/
COPY --from=feature-filter /filtered-features/ ./apps/main/frontend/src/app/features/

WORKDIR /app/apps/main/frontend
RUN npx ng build --configuration=production

# Stage 3: Serve with nginx
FROM nginx:1.27-alpine

COPY --from=build /app/apps/main/frontend/dist/frontend/browser /usr/share/nginx/html
COPY apps/main/frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY apps/main/frontend/entrypoint.sh /docker-entrypoint.d/40-inject-env.sh
RUN chmod +x /docker-entrypoint.d/40-inject-env.sh

ENV PORT=80
EXPOSE ${PORT}
