# MongoDB on Host - Kubernetes Integration

This directory contains documentation and reference manifests for accessing the **host-based MongoDB** server from Kubernetes pods.

## Overview

MongoDB is **installed on the host machine** (not in the cluster). Kubernetes pods access it through a **Service with manual Endpoints** that points to the host IP.

This mirrors the pattern used for `platform/cluster/mysql/`.

## Architecture (high level)

Pods connect to `mongodb.mongodb:27017` → `Service (ClusterIP)` → `Endpoints (host IP)` → `mongod` running on the host.

## Installation

MongoDB is installed/configured by the host provisioning playbook:

- Host playbook: `platform/host/mongodb/install.yml`
- Main playbook: `platform/host/main.yml`

Secrets are sourced from GitHub Actions / Ansible vars:

- `mongodb_root_password` (admin user `admin`)
- `mongodb_wapps_username` (shared app user username)
- `mongodb_wapps_password` (shared app user password)

## What gets created in Kubernetes

- Namespace: `mongodb`
- Service: `mongodb` (DNS: `mongodb.mongodb`)
- Endpoints: `mongodb` → points to host IP on port 27017
- Secret: `mongodb-credentials` (namespace `mongodb`)

See `external-service.yaml` for a reference manifest (Ansible creates these resources automatically).

