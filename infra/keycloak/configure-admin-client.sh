#!/bin/bash
# Grant realm-management client roles to admin-api service account.
# Runs after Keycloak starts and the realm has been imported.

set -euo pipefail

KCADM="/opt/keycloak/bin/kcadm.sh"
REALM="boilerplate"
MAX_RETRIES=30
RETRY_INTERVAL=2

# Wait for Keycloak to be ready
echo "Waiting for Keycloak to be ready..."
for i in $(seq 1 $MAX_RETRIES); do
  if $KCADM config credentials \
    --server "${KEYCLOAK_URL:-http://localhost:8080}" \
    --realm master \
    --user "$KC_BOOTSTRAP_ADMIN_USERNAME" \
    --password "$KC_BOOTSTRAP_ADMIN_PASSWORD" 2>/dev/null; then
    echo "Keycloak is ready."
    break
  fi
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    echo "Keycloak did not become ready in time."
    exit 1
  fi
  sleep $RETRY_INTERVAL
done

# Get the service account user ID for admin-api
SA_USER_ID=$($KCADM get clients -r "$REALM" -q clientId=admin-api --fields id \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null)

if [ -z "$SA_USER_ID" ]; then
  echo "admin-api client not found, skipping configuration."
  exit 0
fi

# Get the service account user
SA_USER=$($KCADM get clients/$SA_USER_ID/service-account-user -r "$REALM" --fields id \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

# Get realm-management client ID
RM_CLIENT_ID=$($KCADM get clients -r "$REALM" -q clientId=realm-management --fields id \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null)

# Assign realm-management roles to the service account
for ROLE_NAME in view-users manage-users view-realm manage-realm; do
  ROLE_JSON=$($KCADM get clients/$RM_CLIENT_ID/roles/$ROLE_NAME -r "$REALM" 2>/dev/null)
  if [ -n "$ROLE_JSON" ]; then
    echo "$ROLE_JSON" | $KCADM create users/$SA_USER/role-mappings/clients/$RM_CLIENT_ID \
      -r "$REALM" -f - 2>/dev/null || true
    echo "Assigned $ROLE_NAME to admin-api service account."
  fi
done

echo "Admin API client configuration complete."
