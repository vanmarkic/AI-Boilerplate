SELECT 'CREATE DATABASE keycloak'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'keycloak') THEN
    CREATE USER keycloak WITH ENCRYPTED PASSWORD 'keycloak';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;