ARG KEYCLOAK_IMAGE=quay.io/keycloak/keycloak:26.1
FROM ${KEYCLOAK_IMAGE}

USER keycloak

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start-dev", "--import-realm"]
