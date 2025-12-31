# Kong + Firebase Authentication - Architecture Diagrams

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WAPPS PLATFORM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │   Browser    │                                                           │
│  │   (User)     │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         │ HTTPS                                                             │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                    NGINX (Host Level)                         │          │
│  │              kong.development.wapps.com                       │          │
│  │          Ports: 80 (HTTP) → 32080, 443 (HTTPS) → 32443      │          │
│  └──────────────────────┬───────────────────────────────────────┘          │
│                         │                                                    │
│  ┌──────────────────────┼────────────────────────────────────────────────┐ │
│  │  Kubernetes Cluster  │                                                 │ │
│  │                      ▼                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │              Kong API Gateway (Namespace: kong)              │    │ │
│  │  │                                                               │    │ │
│  │  │  ┌─────────────────────────────────────────────────────┐   │    │ │
│  │  │  │            JWT Authentication Plugin                 │   │    │ │
│  │  │  │  - Validates Firebase ID Tokens                      │   │    │ │
│  │  │  │  - Fetches JWKS from Firebase                        │   │    │ │
│  │  │  │  - Verifies signature, exp, iss, aud                │   │    │ │
│  │  │  └─────────────────────────────────────────────────────┘   │    │ │
│  │  │                                                               │    │ │
│  │  │  ┌─────────────────────────────────────────────────────┐   │    │ │
│  │  │  │            Route Configuration                       │   │    │ │
│  │  │  │  - Public Routes (no auth)                          │   │    │ │
│  │  │  │  - Protected Routes (auth required)                 │   │    │ │
│  │  │  │  - Optional Auth Routes (personalized)              │   │    │ │
│  │  │  └─────────────────────────────────────────────────────┘   │    │ │
│  │  │                                                               │    │ │
│  │  │  NodePort: 30080 (HTTP), 30081 (Admin), 30443 (HTTPS)      │    │ │
│  │  └───────────────────┬──────────────────────────────────────────┘    │ │
│  │                      │                                                 │ │
│  │       ┌──────────────┼──────────────┬──────────────┐                 │ │
│  │       │              │              │              │                 │ │
│  │       ▼              ▼              ▼              ▼                 │ │
│  │  ┌─────────┐  ┌─────────┐   ┌──────────┐   ┌──────────┐           │ │
│  │  │Catalog  │  │Editorial│   │Aggregator│   │  Other   │           │ │
│  │  │  BFF    │  │ Service │   │   SSR    │   │ Services │           │ │
│  │  │(catalog)│  │(editorial)  │(aggregator)  │          │           │ │
│  │  └─────────┘  └─────────┘   └──────────┘   └──────────┘           │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                               ▲
                               │
                               │ Fetches JWKS
                               │ (Public Keys)
                               │
                    ┌──────────────────────┐
                    │   Firebase Auth      │
                    │  (securetoken.       │
                    │   google.com)        │
                    └──────────────────────┘
```

## 2. Authentication Flow

```
┌────────┐                 ┌─────────┐                ┌──────┐              ┌─────────┐
│ User   │                 │Frontend │                │Kong  │              │Backend  │
│Browser │                 │  App    │                │Gateway              │Service  │
└───┬────┘                 └────┬────┘                └───┬──┘              └────┬────┘
    │                           │                         │                      │
    │  1. Sign In               │                         │                      │
    ├──────────────────────────►│                         │                      │
    │                           │                         │                      │
    │                           │  2. Authenticate        │                      │
    │                           ├────────────────────┐    │                      │
    │                           │                    │    │                      │
    │                           │  ┌──────────────┐  │    │                      │
    │                           │  │Firebase Auth │  │    │                      │
    │                           │  │   Service    │  │    │                      │
    │                           │  └──────┬───────┘  │    │                      │
    │                           │         │          │    │                      │
    │                           │  3. JWT Token      │    │                      │
    │                           │◄────────┘          │    │                      │
    │                           │                    │    │                      │
    │  4. Store Token           │◄───────────────────┘    │                      │
    │◄──────────────────────────┤                         │                      │
    │                           │                         │                      │
    │  5. API Request           │                         │                      │
    │  + Authorization: Bearer  │                         │                      │
    │     <JWT Token>           │                         │                      │
    ├──────────────────────────►│                         │                      │
    │                           │  6. Forward with token  │                      │
    │                           ├────────────────────────►│                      │
    │                           │                         │                      │
    │                           │                         │  7. Validate JWT     │
    │                           │                         ├────────────┐         │
    │                           │                         │            │         │
    │                           │                         │  ┌──────────────┐   │
    │                           │                         │  │ JWT Plugin   │   │
    │                           │                         │  │ - Check sig  │   │
    │                           │                         │  │ - Check exp  │   │
    │                           │                         │  │ - Check iss  │   │
    │                           │                         │  │ - Check aud  │   │
    │                           │                         │  └──────────────┘   │
    │                           │                         │            │         │
    │                           │                         │◄───────────┘         │
    │                           │                         │                      │
    │                           │                         │  8. Forward if valid │
    │                           │                         ├─────────────────────►│
    │                           │                         │                      │
    │                           │                         │  9. Process Request  │
    │                           │                         │                      │
    │                           │                         │  10. Response        │
    │                           │  11. Response           │◄─────────────────────┤
    │  12. Response             │◄────────────────────────┤                      │
    │◄──────────────────────────┤                         │                      │
    │                           │                         │                      │
```

## 3. Token Validation Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    Kong JWT Validation                          │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Request arrives │
                    │  with JWT token │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Extract token   │
                    │ from header     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Parse JWT       │
                    │ header & claims │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Get 'kid' from  │
                    │ JWT header      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Fetch public key│
                    │ from JWKS       │◄────── Cache hit?
                    │ (cached)        │        Yes: Use cached
                    └────────┬────────┘        No: Fetch from Firebase
                             │
                             ▼
                    ┌─────────────────┐
                    │ Verify signature│
                    │ using RS256     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
          ┌─────────────┐    ┌─────────────┐
          │  Invalid    │    │   Valid     │
          │  Signature  │    │  Signature  │
          └──────┬──────┘    └──────┬──────┘
                 │                  │
                 │                  ▼
                 │         ┌─────────────────┐
                 │         │ Verify Claims:  │
                 │         │ - exp (not exp.)│
                 │         │ - iss (Firebase)│
                 │         │ - aud (proj ID) │
                 │         └──────┬──────────┘
                 │                │
                 │       ┌────────┴────────┐
                 │       │                 │
                 │       ▼                 ▼
                 │  ┌─────────┐   ┌─────────────┐
                 │  │ Invalid │   │   Valid     │
                 │  │ Claims  │   │   Claims    │
                 │  └────┬────┘   └──────┬──────┘
                 │       │               │
                 ▼       ▼               ▼
          ┌──────────────────┐   ┌──────────────┐
          │ Return 401       │   │ Forward to   │
          │ Unauthorized     │   │ Backend      │
          └──────────────────┘   └──────────────┘
```

## 4. Route Types

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Kong Route Types                                 │
└─────────────────────────────────────────────────────────────────────────┘

1. PUBLIC ROUTES (No Authentication)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /api/catalog/listings
   /api/catalog/search
   
   Request ──────► Kong ──────► Backend
                    │
                    └──► No JWT check
                         Just forward

   Use Cases:
   • Browse products
   • Search catalog
   • View public content

2. PROTECTED ROUTES (Authentication Required)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /api/catalog/my-listings
   /api/catalog/favorites
   
   Request ──────► Kong ──────► Backend
   + JWT           │
                   ├──► Validate JWT
                   │    ├─ Valid ──────► Forward
                   │    └─ Invalid ────► 401
                   
   Use Cases:
   • User's listings
   • User's favorites
   • Profile management
   • Private data

3. OPTIONAL AUTH ROUTES (Personalized if Authenticated)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /api/catalog
   /api/feed
   
   Request ──────► Kong ──────► Backend
   (with or        │
   without JWT)    ├──► JWT provided?
                   │    ├─ Yes ──► Validate ──► Forward
                   │    │          ├─ Valid ──► Forward (user context)
                   │    │          └─ Invalid ─► Forward (anonymous)
                   │    └─ No ───► Forward (anonymous)
                   
   Use Cases:
   • Personalized feeds
   • Recommendations
   • Adaptive content
```

## 5. Network Topology

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Host Machine                                 │
│  IP: 192.168.x.x                                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │                  NGINX (Port 80/443)                    │         │
│  │                                                          │         │
│  │  kong.development.wapps.com  ──────► 127.0.0.1:32080  │         │
│  │                                      (Kong NodePort)    │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │              K3s Kubernetes Cluster                     │         │
│  │                                                          │         │
│  │  ┌──────────────────────────────────────────────┐     │         │
│  │  │  Kong Namespace                               │     │         │
│  │  │                                               │     │         │
│  │  │  ┌─────────────────────────────────────┐    │     │         │
│  │  │  │ Kong Service (NodePort)             │    │     │         │
│  │  │  │                                      │    │     │         │
│  │  │  │ - 30080 → 8000 (HTTP Proxy)        │    │     │         │
│  │  │  │ - 30081 → 8001 (Admin API)         │    │     │         │
│  │  │  │ - 30443 → 8443 (HTTPS Proxy)       │    │     │         │
│  │  │  └─────────────┬───────────────────────┘    │     │         │
│  │  │                │                             │     │         │
│  │  │                ▼                             │     │         │
│  │  │  ┌─────────────────────────────────────┐    │     │         │
│  │  │  │ Kong Deployment (2-3 replicas)      │    │     │         │
│  │  │  │                                      │    │     │         │
│  │  │  │ Mounts:                              │    │     │         │
│  │  │  │ - ConfigMap: kong-config            │    │     │         │
│  │  │  │   → /kong/declarative/kong.yml      │    │     │         │
│  │  │  └─────────────────────────────────────┘    │     │         │
│  │  └──────────────────────────────────────────────┘     │         │
│  │                                                         │         │
│  │  ┌──────────────────────────────────────────────┐     │         │
│  │  │  Backend Services (Various Namespaces)       │     │         │
│  │  │                                               │     │         │
│  │  │  - catalog-bff (catalog namespace)           │     │         │
│  │  │  - editorial (editorial namespace)           │     │         │
│  │  │  - aggregator-ssr (aggregator namespace)    │     │         │
│  │  └──────────────────────────────────────────────┘     │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## 6. Data Flow - Successful Authentication

```
┌─────────┐   ┌─────────┐   ┌──────┐   ┌─────────┐   ┌─────────┐
│ Browser │   │Frontend │   │Kong  │   │Firebase │   │Backend  │
└────┬────┘   └────┬────┘   └───┬──┘   └────┬────┘   └────┬────┘
     │             │             │           │             │
     │ Login       │             │           │             │
     ├────────────►│             │           │             │
     │             │ Sign In     │           │             │
     │             ├────────────────────────►│             │
     │             │             │           │             │
     │             │ JWT Token   │           │             │
     │             │◄────────────────────────┤             │
     │             │             │           │             │
     │ API Call    │             │           │             │
     │ + JWT Token │             │           │             │
     ├────────────►│             │           │             │
     │             │ Forward     │           │             │
     │             │ + JWT       │           │             │
     │             ├────────────►│           │             │
     │             │             │ Fetch     │             │
     │             │             │ JWKS      │             │
     │             │             ├──────────►│             │
     │             │             │ Public    │             │
     │             │             │ Keys      │             │
     │             │             │◄──────────┤             │
     │             │             │           │             │
     │             │             │ Validate  │             │
     │             │             │ JWT       │             │
     │             │             ├─────┐     │             │
     │             │             │     │     │             │
     │             │             │◄────┘     │             │
     │             │             │           │             │
     │             │             │ Forward   │             │
     │             │             │ + JWT     │             │
     │             │             ├──────────────────────────►
     │             │             │           │             │
     │             │             │           │   Process   │
     │             │             │           │   + Extract │
     │             │             │           │   User Info │
     │             │             │           │   from JWT  │
     │             │             │           │             │
     │             │             │           │   Response  │
     │             │             │◄──────────────────────────┤
     │             │ Response    │           │             │
     │             │◄────────────┤           │             │
     │ Response    │             │           │             │
     │◄────────────┤             │           │             │
     │             │             │           │             │
```

## 7. Configuration Hierarchy

```
platform/cluster/kong/
│
├── kong.deployment.yaml ──────────────────┐
│   (Base deployment spec)                  │
│                                           │
├── kong.service.yaml ─────────────────────┤
│   (NodePort configuration)                │
│                                           ├──► ArgoCD applies
├── kong.configmap.yaml ───────────────────┤    with environment
│   (Routes, services, plugins)            │    overlay
│   Contains: {{ FIREBASE_PROJECT_ID }}    │
│                                           │
├── kong.values.yaml ──────────────────────┤
│   (Base values)                           │
│                                           │
└── kong.firebase-config.yaml ─────────────┘
    (Firebase-specific config template)

                    ↓ Overlaid by ↓

environments/dev/platform/kong.overlay.yml
├── Replicas: 2
├── Firebase Project ID: "your-dev-project"
├── Resources: dev limits
└── Ingress: development.wapps.com

                    ↓ Results in ↓

Final Kubernetes Resources
├── Deployment with Firebase config
├── Service with NodePorts
├── ConfigMap with actual Firebase project ID
└── HPA for autoscaling
```

These diagrams should help visualize how Kong integrates with Firebase authentication in your platform!

