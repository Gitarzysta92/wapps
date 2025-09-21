# Tailscale Configuration for K3s Cluster

This configuration sets up Tailscale to expose your K3s cluster to your homelab network.

## What's Configured

- **Tailscale installation** with automatic startup
- **K3s binding** to all interfaces for external access
- **Firewall rules** for Tailscale traffic (UDP/TCP 41641)
- **Automatic kubeconfig updates** with Tailscale IP when available
- **Automatic hostname generation** based on environment (e.g., `development-wapps`, `staging-wapps`)

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
- **ArgoCD**: `http://<tailscale-ip>:30080`
- **Node Exporter**: `http://<tailscale-ip>:9100/metrics`

#### Via Tailscale DNS (if MagicDNS enabled):
- **K3s API**: `https://<env>-wapps.ts.net:6443`
- **ArgoCD**: `http://<env>-wapps.ts.net:30080`
- **Node Exporter**: `http://<env>-wapps.ts.net:9100/metrics`

Where `<env>` is your target environment (development, staging, production).

### 3. Configure Your Homelab

#### Option A: Use Tailscale DNS
1. Enable MagicDNS in your Tailscale admin console
2. Set your homelab DNS to use Tailscale's DNS server
3. Access services using `<env>-wapps.ts.net`

#### Option B: Use dnsmasq with Tailscale
1. Add Tailscale IPs to your dnsmasq configuration
2. Create custom DNS entries for your services
3. Example dnsmasq config:
   ```
   # Add to /etc/dnsmasq.conf
   server=/ts.net/100.64.0.1
   address=/development-wapps.ts.net/<tailscale-ip>
   address=/staging-wapps.ts.net/<tailscale-ip>
   address=/production-wapps.ts.net/<tailscale-ip>
   ```

## Hostname Pattern

The device hostname is automatically generated as: `<environment>-wapps`

Examples:
- **Development**: `development-wapps`
- **Staging**: `staging-wapps`  
- **Production**: `production-wapps`

This makes it easy to identify which environment each device belongs to in your Tailscale network.

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
curl http://<env>-wapps.ts.net:30080

# Test Node Exporter
curl http://<env>-wapps.ts.net:9100/metrics
```

### Restart Services
```bash
sudo systemctl restart tailscaled
sudo systemctl restart k3s
```
