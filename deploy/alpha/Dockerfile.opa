FROM node:22.17.1-bookworm-slim@sha256:2fa754a9ba4d7adbd2a51d182eaabbe355c82b673624035a38c0d42b08724854 AS policies
WORKDIR /policies
COPY sdk/features/identity/packages/infrastructure/opa/bundles /bundles
COPY deploy/alpha/merge-policy-data.mjs /merge-data.mjs
RUN node /merge-data.mjs

FROM openpolicyagent/opa:1.4.2-static@sha256:3c995dc8a59f6ddfd92eb7404d2f7ff9fe71cd025d9251199957a8a6afbfd76e
COPY --from=policies /policies /policies
CMD ["run", "--server", "--addr=0.0.0.0:8181", "/policies"]
