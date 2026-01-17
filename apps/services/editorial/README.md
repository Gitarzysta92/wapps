# Editorial Service - NestJS + TypeORM

## 🎉 Finally! A Working Solution

Simple NestJS REST API with TypeORM and MySQL. **No CMS complications!**

### Why NestJS?

- ✅ **Compiles cleanly** with Nx webpack
- ✅ **`@data` imports work perfectly** (TypeScript path aliases resolved at build time)
- ✅ **Native MySQL support** via TypeORM
- ✅ **Full control** - no magic, no runtime TS compilation
- ✅ **Auto-generated Swagger docs**
- ✅ **Production-ready**

### Quick Start

```bash
# Build
nx build apps.services.editorial

# Run development
nx serve apps.services.editorial

# MySQL connection (update .env or use environment variable)
DATABASE_URL=mysql://root:password@localhost:3306/editorial
```

### API Endpoints

All endpoints prefixed with `/api`:

**Core Resources:**
- `GET /api/apps` - List all app records
- `POST /api/apps` - Create app record
- `GET /api/apps/:id` - Get app by ID
- `PUT /api/apps/:id` - Update app
- `DELETE /api/apps/:id` - Delete app

**Taxonomies:**
- `/api/categories` - Full CRUD for categories
- `/api/tags` - Full CRUD for tags

**Reference Data:**
- `GET /api/reference/platforms`
- `GET /api/reference/devices`
- `GET /api/reference/socials`
- `GET /api/reference/stores`
- `GET /api/reference/monetization-models`
- `GET /api/reference/user-spans`

**Health:**
- `GET /api/health` - Health check

**Documentation:**
- `GET /api/docs` - Swagger UI

### Features

#### 1. TypeORM Entities
All entities with proper relationships:
- `AppRecord` - Main content with many-to-many relations
- `Category` - Hierarchical (parent/children)
- `Tag` - Simple taxonomy
- Reference entities (Platform, Device, etc.)

#### 2. Automatic Seeding ✨
**The `@data` imports work!**

```typescript
// src/app/seed/seed.service.ts
import { categories, tags, platforms } from '@data'; // ✅ WORKS!

// Seeds automatically on startup
```

#### 3. MySQL Database
TypeORM handles:
- Auto-creates tables (`synchronize: true` in dev)
- Migrations (can be added for production)
- Full relationship management

### Environment Variables

Create `.env` or set in your environment:

```bash
DATABASE_URL=mysql://root:password@localhost:3306/editorial
PORT=1337
NODE_ENV=development
```

### Development

```bash
# Watch mode with hot reload
nx serve apps.services.editorial

# Build for production
nx build apps.services.editorial --configuration=production
```

### Production Deployment

```bash
# Build creates dist/apps/services/editorial with:
# - Compiled main.js
# - package.json (auto-generated)
# - All dependencies resolved

# Docker
docker build -t editorial .
docker run -p 1337:1337 \
  -e DATABASE_URL=mysql://user:pass@host:3306/editorial \
  editorial
```

### Project Structure

```
src/
├── main.ts                    # Bootstrap
├── app/
│   ├── app.module.ts          # Main module with TypeORM
│   ├── health/                # Health check
│   ├── seed/                  # 🌱 Data seeding with @data
│   ├── apps/                  # App records CRUD
│   │   ├── entities/
│   │   ├── apps.controller.ts
│   │   ├── apps.service.ts
│   │   └── apps.module.ts
│   ├── categories/            # Categories CRUD
│   ├── tags/                  # Tags CRUD
│   └── reference/             # Reference data (platforms, devices, etc.)
```

### What Happened Before?

We tried:
1. **Strapi** - Runtime TS compilation broke `@data` imports
2. **Payload CMS v3** - Unstable API, MongoDB only for v2
3. **KeystoneJS** - Same runtime TS compilation issue

**The Problem:** All CMSs compile TypeScript at runtime which doesn't resolve Nx monorepo path aliases.

**The Solution:** NestJS compiles with webpack at build time, resolving all path aliases correctly!

### Next Steps

1. Connect to your MySQL database
2. Service will auto-create tables and seed data
3. Access Swagger docs at `http://localhost:1337/api/docs`
4. Start building your frontend!

### Why This is Better

| Feature | CMS Solutions | NestJS Solution |
|---------|---------------|-----------------|
| `@data` imports | ❌ Broken | ✅ Works |
| Build process | ❌ Complex | ✅ Simple |
| MySQL support | ⚠️ Varies | ✅ Native |
| Control | ❌ Limited | ✅ Full |
| Documentation | ⚠️ Manual | ✅ Auto (Swagger) |
| Monorepo | ❌ Problematic | ✅ Perfect |

---

**Finally working! 🚀**
