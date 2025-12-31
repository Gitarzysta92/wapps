#!/bin/bash
# Test script for Kong + Firebase authentication
# Usage: ./test-firebase-auth.sh <firebase-token> [kong-url]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# Check arguments
if [ "$#" -lt 1 ]; then
    print_error "Usage: $0 <firebase-token> [kong-url]"
    echo ""
    echo "Example: $0 eyJhbGciOiJSUzI1NiIs... http://kong.development.wapps.com"
    echo ""
    echo "To get a Firebase token:"
    echo "  1. Sign in to your app"
    echo "  2. Open browser DevTools → Console"
    echo "  3. Run: firebase.auth().currentUser.getIdToken().then(t => console.log(t))"
    echo "  4. Copy the token"
    exit 1
fi

FIREBASE_TOKEN=$1
KONG_URL=${2:-http://kong.development.wapps.com}

print_info "Testing Firebase authentication with Kong"
print_info "Kong URL: $KONG_URL"
echo ""

# Decode and display token info
print_info "Decoding Firebase token..."
TOKEN_PAYLOAD=$(echo "$FIREBASE_TOKEN" | cut -d. -f2)
# Add padding if needed
while [ $((${#TOKEN_PAYLOAD} % 4)) -ne 0 ]; do
    TOKEN_PAYLOAD="${TOKEN_PAYLOAD}="
done

DECODED=$(echo "$TOKEN_PAYLOAD" | base64 -d 2>/dev/null || echo "$TOKEN_PAYLOAD" | base64 -D 2>/dev/null)

if [ $? -eq 0 ]; then
    print_success "Token decoded successfully"
    echo "$DECODED" | jq '.' 2>/dev/null || echo "$DECODED"
    echo ""
    
    # Extract key claims
    ISSUER=$(echo "$DECODED" | jq -r '.iss' 2>/dev/null)
    AUDIENCE=$(echo "$DECODED" | jq -r '.aud' 2>/dev/null)
    EXPIRY=$(echo "$DECODED" | jq -r '.exp' 2>/dev/null)
    EMAIL=$(echo "$DECODED" | jq -r '.email' 2>/dev/null)
    USER_ID=$(echo "$DECODED" | jq -r '.user_id' 2>/dev/null)
    
    print_info "Token Claims:"
    echo "  Issuer: $ISSUER"
    echo "  Audience: $AUDIENCE"
    echo "  Email: $EMAIL"
    echo "  User ID: $USER_ID"
    
    # Check expiry
    CURRENT_TIME=$(date +%s)
    if [ "$EXPIRY" != "null" ] && [ ! -z "$EXPIRY" ]; then
        if [ $CURRENT_TIME -lt $EXPIRY ]; then
            REMAINING=$((EXPIRY - CURRENT_TIME))
            print_success "Token is valid (expires in ${REMAINING}s)"
        else
            print_error "Token has expired!"
            exit 1
        fi
    fi
    echo ""
else
    print_warning "Could not decode token (continuing anyway...)"
    echo ""
fi

# Test counter
PASSED=0
FAILED=0

# Helper function to run test
run_test() {
    local TEST_NAME=$1
    local URL=$2
    local USE_AUTH=$3
    local EXPECTED_STATUS=$4
    
    print_test "$TEST_NAME"
    echo "  URL: $URL"
    echo "  Auth: $USE_AUTH"
    echo "  Expected: $EXPECTED_STATUS"
    
    if [ "$USE_AUTH" = "true" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $FIREBASE_TOKEN" "$URL" 2>&1)
    else
        RESPONSE=$(curl -s -w "\n%{http_code}" "$URL" 2>&1)
    fi
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n -1)
    
    echo "  Got: $HTTP_CODE"
    
    if [ "$HTTP_CODE" = "$EXPECTED_STATUS" ]; then
        print_success "Test passed: $TEST_NAME"
        ((PASSED++))
    else
        print_error "Test failed: $TEST_NAME (expected $EXPECTED_STATUS, got $HTTP_CODE)"
        ((FAILED++))
        if [ ! -z "$BODY" ]; then
            echo "  Response: $BODY" | head -c 200
        fi
    fi
    echo ""
}

# Run tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Running Authentication Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Public endpoint without auth (should succeed)
run_test "Public endpoint without auth" \
    "${KONG_URL}/api/catalog/listings" \
    "false" \
    "200"

# Test 2: Public endpoint with auth (should succeed)
run_test "Public endpoint with auth" \
    "${KONG_URL}/api/catalog/listings" \
    "true" \
    "200"

# Test 3: Protected endpoint without auth (should fail)
run_test "Protected endpoint without auth" \
    "${KONG_URL}/api/catalog/my-listings" \
    "false" \
    "401"

# Test 4: Protected endpoint with auth (should succeed)
run_test "Protected endpoint with auth" \
    "${KONG_URL}/api/catalog/my-listings" \
    "true" \
    "200"

# Test 5: Optional auth endpoint without auth (should succeed)
run_test "Optional auth endpoint without auth" \
    "${KONG_URL}/api/catalog" \
    "false" \
    "200"

# Test 6: Optional auth endpoint with auth (should succeed)
run_test "Optional auth endpoint with auth" \
    "${KONG_URL}/api/catalog" \
    "true" \
    "200"

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_success "Passed: $PASSED"
if [ $FAILED -gt 0 ]; then
    print_error "Failed: $FAILED"
else
    print_info "Failed: $FAILED"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    print_success "All tests passed! ✨"
    exit 0
else
    print_error "Some tests failed. Check Kong configuration and logs."
    echo ""
    print_info "Debugging steps:"
    echo "  1. Check Kong logs:"
    echo "     kubectl logs -n kong -l app=kong --tail=50"
    echo ""
    echo "  2. Verify Kong configuration:"
    echo "     kubectl get configmap kong-config -n kong -o yaml"
    echo ""
    echo "  3. Check JWT plugin:"
    echo "     kubectl port-forward -n kong svc/kong 8001:8001"
    echo "     curl http://localhost:8001/plugins | jq '.data[] | select(.name == \"jwt\")'"
    echo ""
    echo "  4. Verify Firebase project ID matches in Kong config"
    echo ""
    exit 1
fi

