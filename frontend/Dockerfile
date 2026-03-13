# Stage 1: Filter features by tier
ARG NODE_IMAGE=node:22-slim
FROM ${NODE_IMAGE} AS feature-filter
RUN apt-get update && apt-get install -y python3 python3-pip && pip3 install pyyaml --break-system-packages
ARG TIER=3
COPY packages/monorepo-tier-filter/ /monorepo-tier-filter/
RUN pip3 install /monorepo-tier-filter/ --break-system-packages
COPY shared/scripts/filter-features.py /filter.py
COPY frontend/src/app/features/ /all-features/
RUN python3 /filter.py --tier=$TIER --src=/all-features/ --dest=/filtered-features/ --frontend

# Stage 2: Build frontend with only filtered features
ARG NODE_IMAGE=node:22-slim
FROM ${NODE_IMAGE}
WORKDIR /app

COPY frontend/package.json ./
RUN npm i

COPY frontend/ .
COPY --from=feature-filter /filtered-features/ ./src/app/features/

USER node

EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0"]
