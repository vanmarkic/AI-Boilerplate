# Deployments (per-customer / per-environment config overlays)

Each subdirectory represents a **deployment target** — a specific customer, environment, or combination. This separates _what the app can do_ (tiers) from _where and how it runs_ (deployments).

## Structure

```
deployments/
├── default/              # Base config — all deployments inherit from this
│   ├── .env              # Docker Compose overrides
│   └── config.yaml       # Deployment metadata
├── customer-acme/        # ACME Corp deployment
│   ├── .env              # Overrides (TIER, credentials, URLs)
│   ├── config.yaml       # Customer metadata
│   └── docker-compose.override.yml  # Optional service customisation
└── README.md
```

## Usage

```bash
# Deploy for a specific customer:
make deploy TARGET=customer-acme

# Or manually:
cp deployments/customer-acme/.env .env
docker compose up --build
```

## Adding a new customer

1. Copy `deployments/default/` to `deployments/customer-<name>/`
2. Edit `.env` — set TIER, credentials, URLs, branding vars
3. Optionally add a `docker-compose.override.yml` for infra changes
4. Commit the new directory (secrets should use a vault, not `.env` in prod)

## Separation of concerns

| Layer | Controls | File |
|-------|----------|------|
| **Tier** | Which features are included in the build | `manifest.yaml` per feature |
| **Deployment** | Where it runs, credentials, URLs, branding | `deployments/<target>/.env` |
| **Runtime flags** | Toggle features within the shipped tier | `FEATURE_FLAGS` env var |
