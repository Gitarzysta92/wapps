FROM node:22-bookworm-slim AS policies
WORKDIR /policies
COPY libs/utils/opa/bundles /bundles
COPY deploy/local/opa/merge-data.mjs /merge-data.mjs
RUN node /merge-data.mjs

FROM openpolicyagent/opa:1.4.2-static
COPY --from=policies /policies /policies
CMD ["run", "--server", "--addr=0.0.0.0:8181", "/policies"]
