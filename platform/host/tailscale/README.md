# Tailscale Configuration for K3s Cluster

This configuration sets up Tailscale to expose your K3s cluster to your homelab network.

## What's Configured

- **Tailscale installation** with automatic startup
- **K3s binding** to all interfaces for external access
- **Firewall rules** for Tailscale traffic (UDP/TCP 41641)
- **Automatic kubeconfig updates** with Tailscale IP when available
- **Automatic hostname generation** based on environment (e.g., `development-wapps`, `staging-wapps`)
- **Subdomain-based service access** for clean URLs

## Setup Instructions

### 1. Authentication
The playbook supports automated authentication via environment variable:

#### Automated (Recommended)
Set the `TAILSCALE_AUTH_KEY` environment variable:
```bash
export TAILSCALE_AUTH_KEY="tskey-auth-xxxxx"
```

The playbook will automatically authenticate Tailscale during provisioning.

#### GitHub Actions
For automated provisioning via GitHub Actions, add the auth key as a repository secret:
1. Go to your repository Settings → Secrets and variables → Actions
2. Add a new secret named `TAILSCALE_AUTH_KEY`
3. Set the value to your Tailscale auth key (tskey-auth-xxxxx)

#### Manual Authentication
If no auth key is provided, authenticate manually after the playbook runs:
```bash
sudo tailscale up --hostname="development-wapps"
```

### 2. Access Your Services

Once authenticated, your services will be available via:

#### Via Tailscale IP:
- **K3s API**: `https://<tailscale-ip>:6443`
- **ArgoCD**: `https://<tailscale-ip>:32443`
- **Node Exporter**: `http://<tailscale-ip>:9100/metrics`

#### Via Tailscale DNS (if MagicDNS enabled):
- **K3s API**: `https://k3s-api.<env>-wapps.ts.net:6443`
- **ArgoCD**: `https://argocd.<env>-wapps.ts.net`
- **Node Exporter**: `http://metrics.<env>-wapps.ts.net:9100/metrics`

Where `<env>` is your target environment (development, staging, production).

### 3. Configure Your Homelab

#### Option A: Use Tailscale DNS
1. Enable MagicDNS in your Tailscale admin console
2. Set your homelab DNS to use Tailscale's DNS server
3. Access services using subdomains like `argocd.development-wapps.ts.net`

#### Option B: Use dnsmasq with Tailscale
1. Add Tailscale IPs to your dnsmasq configuration
2. Create custom DNS entries for your services
3. Example dnsmasq config:
   ```
   # Add to /etc/dnsmasq.conf
   server=/ts.net/100.64.0.1
   address=/k3s-api.development-wapps.ts.net/<tailscale-ip>
   address=/argocd.development-wapps.ts.net/<tailscale-ip>
   address=/metrics.development-wapps.ts.net/<tailscale-ip>
   ```

## Hostname Pattern

The device hostname is automatically generated as: `<environment>-wapps`

Examples:
- **Development**: `development-wapps`
- **Staging**: `staging-wapps`  
- **Production**: `production-wapps`

This makes it easy to identify which environment each device belongs to in your Tailscale network.

## Service Subdomains

Each service gets its own subdomain for clean access:

- **K3s API**: `k3s-api.<env>-wapps.ts.net:6443`
- **ArgoCD**: `argocd.<env>-wapps.ts.net` (HTTPS on port 443)
- **Node Exporter**: `metrics.<env>-wapps.ts.net:9100`

## DNS Management

The playbook can automatically create DNS records in Tailscale for easy access to your services.

### Setup DNS Management

#### Required Secrets
Add these secrets to your GitHub repository:

1. **`TAILSCALE_API_TOKEN`** - Your Tailscale API token
2. **`TAILSCALE_DOMAIN`** - Your Tailscale domain (e.g., `your-domain.ts.net`)

#### How to Get Tailscale API Token
1. Go to [Tailscale Admin Console](https://login.tailscale.com/admin/settings/keys)
2. Click **"Generate auth key"**
3. Select **"API token"** instead of auth key
4. Copy the token (starts with `tskey-api-`)

### DNS Records Created

The playbook will automatically create these DNS records:

- **K3s API**: `k3s-api.your-domain.ts.net` → `https://k3s-api.your-domain.ts.net:6443`
- **ArgoCD**: `argocd.your-domain.ts.net` → `https://argocd.your-domain.ts.net`
- **Node Exporter**: `metrics.your-domain.ts.net` → `http://metrics.your-domain.ts.net:9100/metrics`

### Access Your Services

Once DNS records are created, you can access your services using clean URLs:

```bash
# K3s API
kubectl get nodes --server https://k3s-api.your-domain.ts.net:6443

# ArgoCD
open https://argocd.your-domain.ts.net

# Node Exporter metrics
curl http://metrics.your-domain.ts.net:9100/metrics
```

### Manual DNS Management

If you prefer to manage DNS records manually:

```bash
# List existing records
curl -H "Authorization: Bearer $TAILSCALE_API_TOKEN" \
  "https://api.tailscale.com/api/v2/dns/nameservers/your-domain.ts.net/records"

# Create a new A record
curl -X POST \
  -H "Authorization: Bearer $TAILSCALE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"A","name":"argocd","value":"100.64.0.1"}' \
  "https://api.tailscale.com/api/v2/dns/nameservers/your-domain.ts.net/records"
```

## Security Notes

- Tailscale provides encrypted, authenticated access
- No need to expose ports to the public internet
- Access is limited to devices in your Tailscale network
- Consider using Tailscale ACLs for fine-grained access control

## Troubleshooting

### Check Tailscale Status
```bash
sudo tailscale status
sudo tailscale ip -4
```

### Check Service Accessibility
```bash
# Test K3s API
kubectl get nodes --kubeconfig=/home/runner/.kube/config

# Test ArgoCD
curl https://argocd.development-wapps.ts.net

# Test Node Exporter
curl http://metrics.development-wapps.ts.net:9100/metrics
```

### Restart Services
```bash
sudo systemctl restart tailscaled
sudo systemctl restart k3s
```
