# ArgoCD Cluster Configuration

This directory contains ArgoCD cluster-level manifests for GitOps deployment.

## Files

- `namespace.yaml` - ArgoCD namespace
- `install.yaml` - Placeholder for ArgoCD installation (uses upstream manifest)
- `ingress.yaml` - Ingress configuration for ArgoCD access
- `kustomization.yaml` - Kustomize configuration

## Installation

ArgoCD is installed using the upstream manifest:

```bash
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

Then apply the ingress:

```bash
kubectl apply -f ingress.yaml
```

## Access

- **Host NGINX**: `https://argocd.<env>.wapps.com`
- **Tailscale**: `https://<tailscale-ip>:443`
- **Ingress**: `https://argocd.development-wapps.ts.net`

## GitOps Integration

This ArgoCD instance will manage the entire cluster via GitOps, including itself (bootstrap).
