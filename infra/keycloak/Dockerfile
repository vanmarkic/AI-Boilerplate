FROM quay.io/keycloak/keycloak:26.1

COPY infra/keycloak/configure-admin-client.sh /opt/keycloak/configure-admin-client.sh

USER keycloak

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--import-realm"]
