#!/bin/sh
set -eu
umask 077
mkdir -p /data/wapps-alpha/secrets
docker run --rm --network none --user 0 --entrypoint tar -v /data/wapps-alpha/secrets:/config:ro ghcr.io/gitarzysta92/wapps-alpha-editorial@sha256:c67055d8db5493dd5051fbf939755f08ea23e13627dc4671661c7a43074ed3f1 -C /config -cf - mysql.env mongodb.env rabbitmq.env minio.env editorial.env editorial-materializer.env discussion-migrate.env discussion.env discussion-materializer.env catalog-bff.env identity-migrate.env account-management.env firebase-auth-validator.env > /tmp/wapps-config.tar
tar -xf /tmp/wapps-config.tar -C /data/wapps-alpha/secrets
rm /tmp/wapps-config.tar
