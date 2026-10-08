# Wapps alpha on Coolify

This deployment publishes the current aggregator portal at https://alpha.wapps.ai.
It uses the bundled catalog and browser-local demo accounts, favorites, preferences,
drafts, and discussions. Data is not shared between browsers. It does not deploy
the local development databases, Firebase emulator, or backend services.

## Coolify configuration

- Repository: `https://github.com/Gitarzysta92/wapps`
- Branch: `codex/coolify-alpha`
- Build pack: Docker Compose
- Base directory: `/`
- Compose file: `/compose.alpha.yaml`
- Server: the server running the `sandbox3` Cloudflare tunnel (`coolify-01`).
- No Coolify domain or additional proxy route is needed.

The `portal` container listens on port 8080 and publishes only
`127.0.0.1:4203` on the server. The existing Cloudflare tunnel route maps
`alpha.wapps.ai` to `http://localhost:4203`. HTTPS terminates at Cloudflare.
The connector must share the server's network namespace for that address to work.

The Docker build optimizes the Angular application and omits source maps. No
deployment secrets are needed for this demo. Keep the deployment branch up to
date with application changes before redeploying.

## Verification

```sh
docker compose -f compose.alpha.yaml config --quiet
docker compose -f compose.alpha.yaml up -d --build --wait
curl --fail http://127.0.0.1:4203/health
curl --fail https://alpha.wapps.ai/health
```

Verify the public portal, a direct link to `/discover`, catalog search, and guest
sign-in in a browser. A deployment replaces application files but preserves each
visitor's browser-local data. Stop this Coolify resource to roll back public
availability, or redeploy a previous commit to roll back application changes.
