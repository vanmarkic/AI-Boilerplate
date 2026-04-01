#!/bin/sh
# Inject runtime environment variables into the built Angular app.
INDEX_FILE=/usr/share/nginx/html/index.html

if [ -n "$KEYCLOAK_URL" ]; then
  sed -i "s|</head>|<script>window.__env={keycloakUrl:\"${KEYCLOAK_URL}\",keycloakRealm:\"${KEYCLOAK_REALM:-boilerplate}\",keycloakClientId:\"${KEYCLOAK_CLIENT_ID:-frontend-app}\"};</script></head>|" "$INDEX_FILE"
fi
