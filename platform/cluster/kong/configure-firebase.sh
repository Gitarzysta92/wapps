#!/bin/bash
# Script to configure Kong with Firebase authentication
# Usage: ./configure-firebase.sh <firebase-project-id> <environment>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check arguments
if [ "$#" -lt 1 ]; then
    print_error "Usage: $0 <firebase-project-id> [environment]"
    echo ""
    echo "Example: $0 wapps-dev-12345 dev"
    echo ""
    echo "Arguments:"
    echo "  firebase-project-id: Your Firebase project ID from Firebase Console"
    echo "  environment: Target environment (default: dev)"
    exit 1
fi

FIREBASE_PROJECT_ID=$1
ENVIRONMENT=${2:-dev}

print_info "Configuring Kong with Firebase authentication"
print_info "Firebase Project ID: $FIREBASE_PROJECT_ID"
print_info "Environment: $ENVIRONMENT"

# Validate Firebase project ID format
if [[ ! "$FIREBASE_PROJECT_ID" =~ ^[a-z0-9-]+$ ]]; then
    print_error "Invalid Firebase project ID format. Should contain only lowercase letters, numbers, and hyphens."
    exit 1
fi

# Calculate derived values
FIREBASE_ISSUER="https://securetoken.google.com/${FIREBASE_PROJECT_ID}"
FIREBASE_JWKS_URI="https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com"
FIREBASE_AUDIENCE="${FIREBASE_PROJECT_ID}"

print_info "Derived values:"
print_info "  Issuer: $FIREBASE_ISSUER"
print_info "  JWKS URI: $FIREBASE_JWKS_URI"
print_info "  Audience: $FIREBASE_AUDIENCE"

# Check if running from correct directory
if [ ! -f "platform/cluster/kong/kong.configmap.yaml" ]; then
    print_error "This script must be run from the repository root directory"
    print_error "Current directory: $(pwd)"
    exit 1
fi

# Backup original files
BACKUP_DIR="platform/cluster/kong/.backup-$(date +%Y%m%d-%H%M%S)"
print_info "Creating backup in $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp platform/cluster/kong/kong.configmap.yaml "$BACKUP_DIR/"
cp "environments/${ENVIRONMENT}/platform/kong.overlay.yml" "$BACKUP_DIR/"

# Update ConfigMap
print_info "Updating kong.configmap.yaml..."
sed -i.tmp "s/{{ FIREBASE_PROJECT_ID }}/${FIREBASE_PROJECT_ID}/g" platform/cluster/kong/kong.configmap.yaml
rm platform/cluster/kong/kong.configmap.yaml.tmp 2>/dev/null || true

# Update environment overlay
print_info "Updating environments/${ENVIRONMENT}/platform/kong.overlay.yml..."
OVERLAY_FILE="environments/${ENVIRONMENT}/platform/kong.overlay.yml"

# Replace Firebase project ID in overlay
sed -i.tmp "s/your-firebase-dev-project-id/${FIREBASE_PROJECT_ID}/g" "$OVERLAY_FILE"
sed -i.tmp "s|https://securetoken.google.com/your-firebase-dev-project-id|${FIREBASE_ISSUER}|g" "$OVERLAY_FILE"
rm "${OVERLAY_FILE}.tmp" 2>/dev/null || true

print_info "Configuration updated successfully!"

# Validate YAML syntax
print_info "Validating YAML syntax..."
if command -v yamllint &> /dev/null; then
    yamllint platform/cluster/kong/kong.configmap.yaml && print_info "✓ ConfigMap YAML is valid"
    yamllint "$OVERLAY_FILE" && print_info "✓ Overlay YAML is valid"
else
    print_warning "yamllint not found, skipping YAML validation"
fi

# Show what changed
echo ""
print_info "Summary of changes:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "File: platform/cluster/kong/kong.configmap.yaml"
echo "  - Replaced {{ FIREBASE_PROJECT_ID }} with: $FIREBASE_PROJECT_ID"
echo ""
echo "File: environments/${ENVIRONMENT}/platform/kong.overlay.yml"
echo "  - Updated projectId: $FIREBASE_PROJECT_ID"
echo "  - Updated issuer: $FIREBASE_ISSUER"
echo "  - Updated audience: $FIREBASE_AUDIENCE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show next steps
print_info "Next steps:"
echo "1. Review the changes:"
echo "   git diff platform/cluster/kong/kong.configmap.yaml"
echo "   git diff environments/${ENVIRONMENT}/platform/kong.overlay.yml"
echo ""
echo "2. Apply the configuration to your cluster:"
echo "   kubectl apply -f platform/cluster/kong/kong.configmap.yaml"
echo ""
echo "3. Restart Kong to pick up changes:"
echo "   kubectl rollout restart deployment/kong -n kong"
echo ""
echo "4. Verify Kong is running:"
echo "   kubectl get pods -n kong"
echo "   kubectl logs -n kong -l app=kong --tail=50"
echo ""
echo "5. Test authentication:"
echo "   See SETUP-FIREBASE.md for detailed testing instructions"
echo ""

# Offer to apply changes if kubectl is available
if command -v kubectl &> /dev/null; then
    echo ""
    read -p "Do you want to apply these changes to Kubernetes now? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Applying ConfigMap to Kubernetes..."
        kubectl apply -f platform/cluster/kong/kong.configmap.yaml
        
        print_info "Restarting Kong deployment..."
        kubectl rollout restart deployment/kong -n kong
        
        print_info "Waiting for rollout to complete..."
        kubectl rollout status deployment/kong -n kong
        
        print_info "✓ Kong has been updated and restarted"
        
        # Show pod status
        echo ""
        print_info "Current Kong pod status:"
        kubectl get pods -n kong
    else
        print_info "Skipping Kubernetes deployment. You can apply changes manually later."
    fi
else
    print_warning "kubectl not found. You'll need to apply changes manually."
fi

echo ""
print_info "Configuration complete! Backup saved in: $BACKUP_DIR"
print_info "For detailed setup instructions, see: platform/cluster/kong/SETUP-FIREBASE.md"

