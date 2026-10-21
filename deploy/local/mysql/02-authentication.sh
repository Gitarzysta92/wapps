#!/bin/bash

# This file is sourced by the upstream entrypoint; keep its shell options intact.

# Fresh local volumes only. Existing installations require a reviewed database migration.
if [[ ! ${AUTHENTICATION_DB_PASSWORD:-} =~ ^[A-Za-z0-9_-]{16,128}$ ]]; then
  echo 'AUTHENTICATION_DB_PASSWORD must contain 16-128 URL-safe characters' >&2
  exit 1
fi
docker_process_sql <<SQL
CREATE DATABASE IF NOT EXISTS authentication;
CREATE USER 'authentication'@'%' IDENTIFIED BY '${AUTHENTICATION_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON authentication.* TO 'authentication'@'%';
SQL
