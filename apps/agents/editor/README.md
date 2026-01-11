# Editor Agent

An AI-powered automated agent that consumes raw app records from RabbitMQ, enriches them with missing data using OpenAI, and creates/updates content in the Editorial (Strapi) service.

## Purpose

The editor agent acts as an intelligent data processor in the content pipeline:
- Consumes messages from RabbitMQ queue `catalog-raw-record-processing`
- Enriches data using OpenAI to fill in missing fields
- Associates static data (categories, tags, platforms, devices, monetization models, user spans)
- Generates contact information, compatibility data, and external references
- Creates or updates app records in Strapi

## Architecture

```
Store-App Scrapper → RabbitMQ (raw-record-processing) → Editor Agent (AI Enrichment) → Editorial (Strapi) → Catalog BFF → Frontend
```

### Key Components

- **Infrastructure Layer**
  - `queue-client.ts`: RabbitMQ connection and message consumption
  - `openai-client.ts`: OpenAI API integration for data enrichment
  - `editorial-client.ts`: Editorial (Strapi) service API client

- **Application Layer**
  - `services/data-enrichment.service.ts`: Main service that processes raw records, enriches data with OpenAI, and manages editorial records
  - `constants.ts`: OpenAI prompts and system configuration

## Data Flow

1. **Receive**: Consume `RawRecordDto` from queue `catalog-raw-record-processing`
2. **Check**: Query Editorial service to see if record exists
3. **Enrich**: Use OpenAI to analyze the raw data and generate:
   - Category ID (from static categories list)
   - Tag IDs (from static tags list)
   - Platform IDs (from static platforms list)
   - Device IDs (from static devices list)
   - Monetization IDs (from static monetization models)
   - User span ID (estimated audience size)
   - Contact information (email, phone, website, address, etc.)
   - Compatibility data (devices, platforms)
   - Version information
   - References (external links, sources, documentation)
4. **Update/Create**: Send enriched data to Editorial service
5. **Acknowledge**: Mark message as processed in queue

## Building

```bash
nx build editor-agent
```

## Local Development

### Prerequisites

- RabbitMQ running locally or remotely
- Editorial (Strapi) service running
- OpenAI API key

### Environment Variables

```bash
# RabbitMQ Configuration
export QUEUE_USERNAME=guest
export QUEUE_PASSWORD=guest
export QUEUE_HOST=localhost
export QUEUE_PORT=5672

# Editorial Service Configuration
export EDITORIAL_SERVICE_HOST=http://localhost:1337
export EDITORIAL_SERVICE_API_TOKEN=your-strapi-token

# OpenAI Configuration
export OPENAI_API_KEY=your-openai-api-key
```

### Run in Development Mode

```bash
nx serve editor-agent
```

The agent will:
- Connect to RabbitMQ and listen for messages on `catalog-raw-record-processing` queue
- Process each message using OpenAI for data enrichment
- Create or update records in the Editorial service
- Continue running indefinitely, processing messages as they arrive

## Docker Build

```bash
# Build the Nx project first
nx build editor-agent

# Build Docker image
docker build -f apps/agents/editor/Dockerfile -t editor-agent:latest .
```

## Deployment

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for complete deployment guide including:
- Vault secret configuration
- ArgoCD setup
- Kubernetes deployment
- Testing and troubleshooting

## Static Data

The agent uses static data from `@data` to enrich records:
- **Categories**: Hierarchical category structure
- **Tags**: Available tags for apps
- **Platforms**: Web, iOS, Android, Windows, Linux, MacOS
- **Devices**: Desktop, Mobile, Tablet, etc.
- **Monetization Models**: Free, Freemium, Subscription, Ad-based, One-time purchase, Fees
- **User Spans**: Estimated audience size ranges (1k-10k, 10k-100k, etc.)

## AI-Powered Data Enrichment

The OpenAI integration provides:
- Intelligent category matching based on app description
- Relevant tag selection (max 5-10 most relevant)
- Platform and device compatibility detection
- Monetization model identification
- Contact information extraction
- External reference discovery
- Missing data generation

If OpenAI fails, the service falls back to basic string matching for categories, platforms, and tags.

## Running Unit Tests

Run `nx test editor-agent` to execute the unit tests via [Jest](https://jestjs.io).
