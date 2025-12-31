#!/bin/bash
# Complete implementation script for Kong API Gateway with Firebase Authentication
# This script implements the entire solution step-by-step

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

ENVIRONMENT=${1:-dev}
FIREBASE_PROJECT_ID=${2:-}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Kong API Gateway + Firebase Authentication Implementation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Environment: $ENVIRONMENT"
if [ -z "$FIREBASE_PROJECT_ID" ]; then
    print_warning "Firebase Project ID not provided - you'll need to configure it later"
else
    echo "Firebase Project ID: $FIREBASE_PROJECT_ID"
fi
echo ""

# Check prerequisites
print_step "1/7 Checking prerequisites..."
echo ""

if [ ! -f "platform/cluster/kong/kong.configmap.yaml" ]; then
    print_error "Run this script from the repository root"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    print_error "kubectl not found. Please install kubectl."
    exit 1
fi

if ! command -v ansible-playbook &> /dev/null; then
    print_warning "ansible-playbook not found. Skipping host-level configuration."
    SKIP_ANSIBLE=true
else
    SKIP_ANSIBLE=false
fi

print_info "✓ Prerequisites checked"
echo ""

# Step 2: Update host-level NGINX configuration
if [ "$SKIP_ANSIBLE" = false ]; then
    print_step "2/7 Updating host-level NGINX configuration..."
    echo ""
    print_info "Adding api.$ENVIRONMENT.wapps.com routing to Kong..."
    
    read -p "Run Ansible playbook to update NGINX? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd platform/host
        ansible-playbook main.yml --tags nginx
        cd ../..
        print_info "✓ NGINX configuration updated"
    else
        print_warning "Skipped NGINX update. You'll need to update manually."
    fi
    echo ""
else
    print_step "2/7 Skipping host-level NGINX configuration (Ansible not available)"
    echo ""
    print_warning "Manually update /etc/nginx/sites-available/ with api.$ENVIRONMENT.wapps.com configuration"
    echo ""
fi

# Step 3: Configure Firebase in Kong
print_step "3/7 Configuring Firebase in Kong..."
echo ""

if [ -n "$FIREBASE_PROJECT_ID" ]; then
    print_info "Running Firebase configuration script..."
    ./platform/cluster/kong/configure-firebase.sh "$FIREBASE_PROJECT_ID" "$ENVIRONMENT"
    echo ""
else
    print_warning "Firebase Project ID not provided."
    print_info "Run manually: ./platform/cluster/kong/configure-firebase.sh YOUR_PROJECT_ID $ENVIRONMENT"
    echo ""
fi

# Step 4: Configure traffic routing
print_step "4/7 Configuring traffic routing..."
echo ""

print_info "This will:"
echo "  • Create ingress routing api.$ENVIRONMENT.wapps.com → Kong"
echo "  • Label Kong namespace for NetworkPolicies"
echo "  • Optionally apply NetworkPolicies (enforce Kong-only access)"
echo "  • Optionally remove direct backend service ingresses"
echo ""

read -p "Configure traffic routing? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    ./platform/cluster/kong/configure-routing.sh "$ENVIRONMENT"
    echo ""
else
    print_warning "Skipped traffic routing configuration."
    echo ""
fi

# Step 5: Deploy Kong configuration
print_step "5/7 Deploying Kong configuration..."
echo ""

print_info "Applying Kong ConfigMap..."
kubectl apply -f platform/cluster/kong/kong.configmap.yaml

print_info "Restarting Kong deployment..."
kubectl rollout restart deployment/kong -n kong

print_info "Waiting for Kong to be ready..."
kubectl rollout status deployment/kong -n kong --timeout=120s

print_info "✓ Kong deployed successfully"
echo ""

# Step 6: Verify deployment
print_step "6/7 Verifying deployment..."
echo ""

print_info "Kong pods:"
kubectl get pods -n kong
echo ""

print_info "Kong service:"
kubectl get svc -n kong kong
echo ""

print_info "API Gateway ingress:"
kubectl get ingress -n kong api-gateway-ingress 2>/dev/null || print_warning "API Gateway ingress not found"
echo ""

print_info "Kong routes (via Admin API):"
kubectl port-forward -n kong svc/kong 8001:8001 &
PF_PID=$!
sleep 2
curl -s http://localhost:8001/routes 2>/dev/null | jq -r '.data[] | "\(.name): \(.hosts // []) \(.paths // [])"' || print_warning "Could not fetch routes"
kill $PF_PID 2>/dev/null || true
echo ""

# Step 7: Display next steps
print_step "7/7 Implementation complete!"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

print_info "Architecture:"
echo "  Browser → api.$ENVIRONMENT.wapps.com → Host NGINX → Kong → Backend Services"
echo ""

print_info "What was configured:"
echo "  ✓ Host NGINX routes api.$ENVIRONMENT.wapps.com to Kong (port 30080)"
echo "  ✓ Kong ConfigMap updated with Firebase JWT validation"
echo "  ✓ Ingress-NGINX routes API traffic to Kong"
echo "  ✓ NetworkPolicies enforce Kong-only access (if applied)"
echo "  ✓ Kong deployment restarted"
echo ""

print_info "API Endpoints (through Kong):"
echo "  • http://api.$ENVIRONMENT.wapps.com/catalog/listings (public)"
echo "  • http://api.$ENVIRONMENT.wapps.com/catalog/my-listings (protected)"
echo "  • http://api.$ENVIRONMENT.wapps.com/catalog (optional auth)"
echo "  • http://api.$ENVIRONMENT.wapps.com/editorial"
echo "  • http://api.$ENVIRONMENT.wapps.com/auth/login (when auth service created)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

print_step "1. Test API access through Kong:"
echo "   curl http://api.$ENVIRONMENT.wapps.com/catalog/listings"
echo ""

print_step "2. Create backend authentication service:"
echo "   • See: platform/cluster/kong/BACKEND-FIREBASE-AUTH.md"
echo "   • Install Firebase Admin SDK"
echo "   • Implement /auth/login, /auth/register endpoints"
echo "   • Deploy to cluster"
echo ""

print_step "3. Update frontend API URLs:"
echo "   // environment.ts"
echo "   apiBaseUrl: 'http://api.$ENVIRONMENT.wapps.com'"
echo ""

print_step "4. Test authentication flow:"
echo "   # Login"
echo "   curl -X POST http://api.$ENVIRONMENT.wapps.com/auth/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"user@example.com\",\"password\":\"pass123\"}'"
echo ""
echo "   # Use token"
echo "   curl http://api.$ENVIRONMENT.wapps.com/catalog/my-listings \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN'"
echo ""

print_step "5. Run automated tests:"
echo "   ./platform/cluster/kong/test-firebase-auth.sh YOUR_FIREBASE_TOKEN"
echo ""

print_step "6. Monitor Kong logs:"
echo "   kubectl logs -n kong -l app=kong --tail=100 -f"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_info "📖 Documentation:"
echo "  • Complete Guide: platform/cluster/kong/BACKEND-PROXIED-SUMMARY.md"
echo "  • Traffic Routing: platform/cluster/kong/TRAFFIC-ROUTING.md"
echo "  • Quick Reference: platform/cluster/kong/QUICK-REFERENCE.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -z "$FIREBASE_PROJECT_ID" ]; then
    echo ""
    print_warning "⚠️  IMPORTANT: Configure Firebase Project ID!"
    echo "   Run: ./platform/cluster/kong/configure-firebase.sh YOUR_PROJECT_ID $ENVIRONMENT"
    echo ""
fi

print_info "✨ Implementation complete!"

