# Tailscale Configuration for K3s Cluster

This configuration sets up Tailscale to expose your K3s cluster to your homelab network.

## What's Configured

- **Tailscale installation** with automatic startup
- **K3s binding** to all interfaces for external access
- **Firewall rules** for Tailscale traffic (UDP/TCP 41641)
- **Automatic kubeconfig updates** with Tailscale IP when available

## Setup Instructions

### 1. Authentication
After the Ansible playbook runs, authenticate Tailscale:

```bash
# Option 1: Interactive authentication
sudo tailscale up

# Option 2: Use auth key (recommended for automation)
sudo tailscale up --authkey=<your-auth-key>
```

### 2. Access Your Services

Once authenticated, your services will be available via:

#### Via Tailscale IP:
- **K3s API**: `https://<tailscale-ip>:6443`
- **ArgoCD**: `http://<tailscale-ip>:30080`
- **Node Exporter**: `http://<tailscale-ip>:9100/metrics`

#### Via Tailscale DNS (if MagicDNS enabled):
- **K3s API**: `https://<hostname>.ts.net:6443`
- **ArgoCD**: `http://<hostname>.ts.net:30080`
- **Node Exporter**: `http://<hostname>.ts.net:9100/metrics`

### 3. Configure Your Homelab

#### Option A: Use Tailscale DNS
1. Enable MagicDNS in your Tailscale admin console
2. Set your homelab DNS to use Tailscale's DNS server
3. Access services using hostname.ts.net

#### Option B: Use dnsmasq with Tailscale
1. Add Tailscale IPs to your dnsmasq configuration
2. Create custom DNS entries for your services
3. Example dnsmasq config:
   ```
   # Add to /etc/dnsmasq.conf
   server=/ts.net/100.64.0.1
   address=/k3s.ts.net/<tailscale-ip>
   address=/argocd.ts.net/<tailscale-ip>
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
curl http://<tailscale-ip>:30080

# Test Node Exporter
curl http://<tailscale-ip>:9100/metrics
```

### Restart Services
```bash
sudo systemctl restart tailscaled
sudo systemctl restart k3s
```
