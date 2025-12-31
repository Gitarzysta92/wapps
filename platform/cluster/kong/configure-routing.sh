#!/bin/bash
# Script to configure traffic routing through Kong
# This ensures all API traffic goes through Kong API Gateway

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

ENVIRONMENT=${1:-dev}

print_info "Configuring Kong as API Gateway for environment: $ENVIRONMENT"
echo ""

# Check if we're in the right directory
if [ ! -f "platform/cluster/kong/kong.configmap.yaml" ]; then
    print_error "Run this script from the repository root"
    exit 1
fi

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl not found. Please install kubectl."
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Label Kong namespace (for NetworkPolicy)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl label namespace kong name=kong --overwrite
print_info "✓ Kong namespace labeled"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Deploy API Gateway Ingress"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl apply -f environments/${ENVIRONMENT}/platform/api-gateway-ingress.yaml
print_info "✓ API Gateway Ingress created"
print_info "  All traffic to api.development.wapps.com will route through Kong"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Apply Network Policies (Optional - Enforce Kong-only access)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "Apply NetworkPolicies to enforce Kong-only access? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl apply -f environments/${ENVIRONMENT}/platform/backend-network-policies.yaml
    print_info "✓ Network Policies applied"
    print_warning "  Backend services can now ONLY be accessed via Kong"
else
    print_warning "Skipped NetworkPolicies. Services can still be accessed directly."
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Check for Direct Service Ingresses"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_info "Checking for backend service ingresses that might bypass Kong..."
DIRECT_INGRESSES=$(kubectl get ingress -A | grep -E "(catalog-bff|editorial)" || true)

if [ ! -z "$DIRECT_INGRESSES" ]; then
    print_warning "Found direct ingresses for backend services:"
    echo "$DIRECT_INGRESSES"
    echo ""
    read -p "Remove these direct ingresses? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl delete ingress catalog-bff-ingress -n catalog --ignore-not-found=true
        kubectl delete ingress editorial-ingress -n editorial --ignore-not-found=true
        print_info "✓ Direct ingresses removed"
    else
        print_warning "⚠ Direct ingresses kept. Kong may be bypassed!"
    fi
else
    print_info "✓ No direct backend service ingresses found"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Verify Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_info "Current ingresses:"
kubectl get ingress -A | grep -E "(kong|api-gateway)"
echo ""

print_info "Network policies:"
kubectl get networkpolicies -A | grep -E "(kong|catalog|editorial)" || print_warning "No network policies found"
echo ""

print_info "Kong service:"
kubectl get svc -n kong kong
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Configuration Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_info "Traffic Flow:"
echo "  Browser → api.development.wapps.com → Ingress-NGINX → Kong → Backend Services"
echo ""

print_info "Testing:"
echo "  1. Test through Kong (should work):"
echo "     curl http://api.development.wapps.com/catalog/listings"
echo ""
echo "  2. Test direct access (should fail if NetworkPolicies applied):"
echo "     kubectl run test-pod --rm -i --tty --image=curlimages/curl -- sh"
echo "     curl http://catalog-bff-service.catalog"
echo ""
echo "  3. Check Kong logs:"
echo "     kubectl logs -n kong -l app=kong --tail=50 -f"
echo ""

print_info "Next Steps:"
echo "  1. Update frontend API URLs to use: http://api.development.wapps.com"
echo "  2. Configure DNS: api.development.wapps.com → your host IP"
echo "  3. Test authentication flow with Firebase JWT"
echo ""

print_warning "Important:"
echo "  - Frontend apps (aggregator-csr, etc.) still have direct ingress (as they should)"
echo "  - Only API traffic (backend services) should go through Kong"
echo "  - Monitor Kong logs to ensure all API requests are flowing through"

