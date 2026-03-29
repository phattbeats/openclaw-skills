# API Discovery Strategies

## Well-Known Spec Paths

Check these paths first — if any return an OpenAPI/Swagger spec, parse it directly:

```
/.well-known/openapi.json
/.well-known/openapi.yaml
/openapi.json
/openapi.yaml
/openapi/v3/api-docs
/swagger.json
/swagger.yaml
/swagger/v1/swagger.json
/api-docs
/api-docs.json
/docs/api
/api/docs
/api/swagger
/api/v1/swagger.json
/api/v2/swagger.json
```

## Active Probing Patterns

### Base URL Discovery

Try common API base paths:
```
/api/
/api/v1/
/api/v2/
/v1/
/v2/
/rest/
/graphql
```

For each, send a GET request and check:
- 200 with JSON body → likely an API root
- 401/403 → API exists, needs auth
- 404 with JSON error body → API framework present, wrong path
- 404 with HTML → not an API path

### Resource Discovery

Probe common resource names:
```
/users, /accounts, /customers, /orders, /products, /items
/messages, /notifications, /events, /projects, /tasks
/comments, /posts, /files, /uploads, /settings, /config
/health, /status, /me, /profile
```

For each that returns 200 or 401:
1. Add to catalog
2. Try OPTIONS to discover allowed methods
3. If list returns items, try GET /resource/{id}
4. Check response for nested resource links

### CRUD Probing

For each confirmed resource:
```
GET    /resources           → List
GET    /resources/:id       → Get single
POST   /resources           → Create (send empty body, check error for required fields)
PUT    /resources/:id       → Full update
PATCH  /resources/:id       → Partial update
DELETE /resources/:id       → Delete
```

Non-CRUD endpoints:
```
GET    /resources/search?q=test
GET    /resources/count
POST   /resources/:id/archive
POST   /resources/bulk
GET    /resources/:id/related
```

### Response Analysis

**Pagination style:**
- Cursor: `{ "data": [...], "has_more": true, "next_cursor": "abc" }`
- Offset: `{ "data": [...], "total": 150, "offset": 0, "limit": 20 }`
- Page: `{ "data": [...], "page": 1, "total_pages": 8 }`
- Link header: `Link: <url?page=2>; rel="next"`

**Rate limits (from headers):**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
Retry-After: 60
```

## GraphQL Introspection

If `/graphql` returns 200, try introspection query to map types → CLI commands.

## Docs Page Parsing

1. Fetch with web_fetch
2. Look for endpoint tables, JSON code blocks, parameter lists
3. Follow navigation links for individual endpoint docs
4. Recognize frameworks: Swagger UI, ReadMe.io, Slate/Docusaurus, Redoc
