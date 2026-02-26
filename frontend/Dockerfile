# Stage 1: Filter features by tier
FROM node:22-slim AS feature-filter
RUN apt-get update && apt-get install -y python3 python3-pip && pip3 install pyyaml --break-system-packages
ARG TIER=3
COPY shared/scripts/filter-features.py /filter.py
COPY frontend/src/app/features/ /all-features/
RUN python3 /filter.py --tier=$TIER --src=/all-features/ --dest=/filtered-features/ --frontend

# Stage 2: Build frontend with only filtered features
FROM node:22-slim
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
COPY --from=feature-filter /filtered-features/ ./src/app/features/

EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0"]
