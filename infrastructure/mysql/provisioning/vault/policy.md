kubectl exec -n vault -it vault-0 -- /bin/sh

export VAULT_ADDR=http://127.0.0.1:8200
vault login <your-root-token>

echo 'path "secret/data/editor/app-listing-worker" { capabilities = ["read"] }' | vault policy write editor-agent-policy -

echo 'path "secret/data/editor/app-listing-worker" { capabilities = ["read"] }' | vault policy write editor-agent-policy -


const user = process.env['RABBITMQ_USER'];
const pass = process.env['RABBITMQ_PASSWORD'];
const host = process.env['RABBITMQ_HOST'] || 'localhost';
const port = process.env['RABBITMQ_PORT'] || '5672';

const RABBITMQ_URL = process.env.RABBITMQ_URL!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const STRAPI_URL = process.env.STRAPI_URL!;
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN!;