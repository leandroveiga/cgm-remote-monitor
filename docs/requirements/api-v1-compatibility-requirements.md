# API v1 Client Compatibility Specification

**Document Version:** 1.1  
**Last Updated:** October 2026  
**Status:** Draft  
**Related Documents:** [Data Shape Requirements](./data-shape-requirements.md), [API Layer Audit](../audits/api-layer-audit.md)

---

## 1. Purpose

This document specifies the compatibility requirements that Nightscout's API v1 must maintain to support existing client applications. Breaking these behaviors will cause data sync failures for patients relying on these integrations.

---

## 2. Client Ecosystem Overview

### 2.1 Primary Clients

| Client | Platform | Sync Method | Data Volume | Priority |
|--------|----------|-------------|-------------|----------|
| **AAPS** | Android | REST + WebSocket | High (batch) | Critical |
| **Loop** | iOS | REST | Medium | Critical |
| **xDrip+** | Android | REST | High (batch) | Critical |
| **Trio** | iOS | REST | Medium | Critical |
| **OpenAPS** | Linux | REST | Low | High |
| **Spike** | iOS | REST | Medium | Medium |
| **Nightguard** | iOS | REST (read-only) | Low | Medium |
| **Sugarmate** | iOS | REST (read-only) | Low | Medium |

### 2.2 Client Communication Patterns

```
┌─────────────────────────────────────────────────────────────┐
│                    AAPS / AndroidAPS                        │
├─────────────────────────────────────────────────────────────┤
│ Sync Pattern:                                               │
│   - Real-time: WebSocket for immediate updates              │
│   - Batch sync: REST POST with arrays for historical data   │
│   - Typical batch: 5-50 devicestatus records                │
│                                                             │
│ Collections Used:                                           │
│   - devicestatus (pump status, loop decisions)              │
│   - treatments (boluses, temp basals, carbs)                │
│   - entries (CGM readings - rarely, usually from bridge)    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         Loop                                │
├─────────────────────────────────────────────────────────────┤
│ Sync Pattern:                                               │
│   - REST POST for each loop cycle                           │
│   - May batch multiple records per request                  │
│                                                             │
│ Collections Used:                                           │
│   - devicestatus (loop predictions, enacted basals)         │
│   - treatments (boluses, carbs)                             │
│   - profile (therapy settings)                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        xDrip+                               │
├─────────────────────────────────────────────────────────────┤
│ Sync Pattern:                                               │
│   - REST POST for CGM data                                  │
│   - Batch uploads after connectivity gaps                   │
│   - Can send 100+ entries in backfill scenarios             │
│                                                             │
│ Collections Used:                                           │
│   - entries (primary - SGV data from CGM)                   │
│   - treatments (calibrations, notes)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Compatibility Requirements

### 3.1 Endpoint Requirements

#### COMPAT-001: Essential Endpoints

The following endpoints MUST remain available and functional:

| Endpoint | Methods | Client Usage | Priority |
|----------|---------|--------------|----------|
| `POST /api/v1/entries` | POST | xDrip, bridges | Critical |
| `GET /api/v1/entries` | GET | All clients | Critical |
| `GET /api/v1/entries/current` | GET | All clients | Critical |
| `POST /api/v1/treatments` | POST | AAPS, Loop | Critical |
| `GET /api/v1/treatments` | GET | All clients | Critical |
| `POST /api/v1/devicestatus` | POST | AAPS, Loop | Critical |
| `GET /api/v1/devicestatus` | GET | All clients | Critical |
| `GET /api/v1/status` | GET | All clients | Critical |
| `POST /api/v1/profile` | POST | Loop | High |
| `GET /api/v1/profile` | GET | All clients | High |

#### COMPAT-002: Query Parameters

Clients depend on these query parameter patterns:

```
GET /api/v1/entries?count=10
GET /api/v1/entries?find[type]=sgv
GET /api/v1/entries?find[date][$gte]=1705000000000
GET /api/v1/treatments?find[eventType]=Correction+Bolus
```

**MUST support:** `count`, `find[field]`, `find[field][$gte]`, `find[field][$lte]`

### 3.2 Input Shape Requirements

#### COMPAT-003: Single Object Support

All POST endpoints MUST accept a single JSON object:

```json
POST /api/v1/devicestatus
Content-Type: application/json

{
  "device": "AAPS",
  "pump": { "status": "normal" },
  "created_at": "2026-01-15T10:00:00.000Z"
}
```

#### COMPAT-004: Array Support

The following POST endpoints MUST accept arrays of objects:

| Endpoint | Array Support | Notes |
|----------|---------------|-------|
| `/api/v1/treatments` | MUST accept | AAPS batch sync |
| `/api/v1/entries` | MUST accept | xDrip backfill |
| `/api/v1/devicestatus` | MUST accept | AAPS/Loop batch |
| `/api/v1/profile` | Single only | Typical usage |
| `/api/v1/food` | Single only | Typical usage |
| `/api/v1/activity` | Array required | By design |

**Example (entries batch):**
```json
POST /api/v1/entries
Content-Type: application/json

[
  { "sgv": 120, "date": 1705000000000, "type": "sgv" },
  { "sgv": 125, "date": 1705000300000, "type": "sgv" },
  { "sgv": 118, "date": 1705000600000, "type": "sgv" }
]
```

**Rationale:** xDrip+ and AAPS use batch uploads for:
- Backfilling data after connectivity gaps
- Syncing historical data from pump
- Uploading multiple CGM readings collected offline

#### COMPAT-005: Minimum Batch Size

POST endpoints for treatments, entries, and devicestatus MUST accept batches of at least **100 documents** without:
- Timeout errors
- Data loss
- Partial failures (unless individual documents are invalid)

**Observed:** Tests validate 50+ document batches; xDrip backfill scenarios may send 100+.

### 3.3 Response Format Requirements

#### COMPAT-006: Success Response Array

All successful POST operations MUST return an array:

```json
HTTP/1.1 200 OK

[
  {
    "_id": "65a5c1234567890abcdef12",
    "sgv": 120,
    "date": 1705000000000,
    "type": "sgv"
  }
]
```

**Even for single object input, response is an array.**

#### COMPAT-007: Document ID Assignment

Created documents MUST include an `_id` field in the response:
- Format: MongoDB ObjectId string
- Must be unique and usable for subsequent GET/DELETE operations

#### COMPAT-008: Timestamp Fields

The following timestamp behaviors MUST be preserved:

| Field | Behavior |
|-------|----------|
| `created_at` | Added if missing (ISO 8601 string) |
| `date` | Preserved as-is (millisecond epoch for entries) |
| `sysTime` | Preserved as-is if provided |

### 3.4 Authentication Requirements

#### COMPAT-009: API Secret Authentication

Clients using API_SECRET MUST be able to authenticate via:

```
Header: api-secret: <sha1-hash-of-secret>
```

Or via query parameter:
```
?token=<sha1-hash-of-secret>
```

#### COMPAT-010: Readable Permissions Default

When `authDefaultRoles` includes `readable`:
- GET endpoints should be accessible without authentication
- POST/PUT/DELETE require valid authentication

### 3.5 Real-time Requirements (WebSocket)

#### COMPAT-011: Storage Namespace

The `/storage` WebSocket namespace MUST support:

| Message | Direction | Purpose |
|---------|-----------|---------|
| `authorize` | Client → Server | Authenticate with token |
| `dbAdd` | Client → Server | Insert documents |
| `dbUpdate` | Client → Server | Update documents |
| `dbRemove` | Client → Server | Delete documents |
| `dataUpdate` | Server → Client | Notify of changes |

#### COMPAT-012: dbAdd Array Support

The `dbAdd` handler MUST accept arrays in the `data` field:

```javascript
socket.emit('dbAdd', {
  collection: 'devicestatus',
  data: [
    { device: 'AAPS', pump: {...} },
    { device: 'AAPS', pump: {...} }
  ]
});
```

---

## 4. Known Client Quirks

### 4.1 AAPS Specifics

| Behavior | Details |
|----------|---------|
| WebSocket preference | Uses WebSocket when available for lower latency |
| Batch uploads | Sends 5-50 devicestatus records per sync |
| Retry logic | Exponential backoff on failures |
| Required fields | `device`, `created_at` for devicestatus |

### 4.2 xDrip+ Specifics

| Behavior | Details |
|----------|---------|
| Large batches | Can send 100+ entries during backfill |
| Calibration sync | Sends `mbg` entries for calibrations |
| Treatment notes | Free-form text in treatment notes |
| Time format | Uses epoch milliseconds for `date` |

### 4.3 Loop Specifics

| Behavior | Details |
|----------|---------|
| Profile sync | Uploads complete profile on changes |
| Prediction data | Large `loop.predicted` arrays in devicestatus |
| Enacted data | `loop.enacted` contains basal commands |

### 4.4 AAPS NSClient v3 with a v1 uploader (xDrip+)

**Origin:** technical analysis and production diagnosis (2026-10-22), AAPS 3.4.2.6 and Nightscout 15.0.8/15.0.9. **Author:** Mary (analyst), BIA Tech.

| Aspect | Details |
|--------|---------|
| Scenario | xDrip+ uploads glucose through API v1 (`/api/v1/entries`); AAPS reads Nightscout through NSClient v3 |
| Pre-15.0.9 behavior | v1 records had no `srvModified`, so they were absent from `/api/v3/<collection>/history` and AAPS received no new glucose |
| 15.0.9 behavior | v1, WebSocket and in-process writes carry `srvModified`/`srvCreated` and appear in v3 history (upstream #8775). Records written before the upgrade stay invisible to v3 history |
| Storage socket | `/storage` events (`create`/`update`/`delete`) are emitted only by API v3 writes, including in 15.0.9 (see [lib/api3/doc/socket.md](../../lib/api3/doc/socket.md)) |
| AAPS with "Use WebSockets" on | After the initial load AAPS relies only on `/storage` events, so glucose written through v1 never arrives |
| AAPS with "Use WebSockets" off | AAPS polls v3 `lastModified` and `history` by `srvModified`; glucose from v1 uploaders arrives with a delay of up to about 1 minute |
| xDrip+ upload | Supports only API v1 for upload (v3 exists only for follower mode, upstream discussion #4462) |

**Recommended configuration:** in AAPS, NSClient (v3), turn off "Use WebSockets" and run "Clear and reload" once. Validated in production on 2026-10-22: automatic sync resumed. Alternatively, use the NSClient v1 plugin consistently in AAPS and AAPSClient (a 15.0.0 release note says not to mix v1 and v3 clients).

**Known limitation:** with WebSockets on, a bridge that emits `/storage` events for v1 writes would be needed. It is not implemented.

**Diagnostic hints:**
- The log line "Missing or bad access token or JWT" is the normal first AAPS call (empty Bearer) before it refreshes the JWT through `/api/v2/authorization/request/<token>`; it is not a failure.
- A new image invalidates JWTs issued before the deploy (the signing key is regenerated at build); AAPS recovers by requesting a new one.
- Check that new glucose carries `srvModified` and appears in `GET /api/v3/entries/history/<epoch-ms>` with a `Bearer` JWT of a subject with read permission (the `api-secret` header is not accepted by API v3).

> Documento gerado com apoio de IA (BIA Tech). O conteúdo deve ser validado pelo profissional responsável antes de uso em decisões de produto.

---

## 5. Breaking Change Policy

### 5.1 Never Break

These behaviors MUST NOT change:

1. Array input acceptance on POST endpoints
2. Array response format for all POST operations
3. API secret authentication via header or query
4. `_id` field in created document responses
5. Query parameter patterns (`count`, `find[field]`)

### 5.2 Deprecation Process

For planned changes:

1. Announce 6 months before deprecation
2. Provide migration documentation
3. Support old behavior alongside new for 1 year
4. Log warnings when deprecated patterns are used

---

## 6. Testing Requirements

### 6.1 Client Simulation Tests

Each release SHOULD include tests simulating:

1. **AAPS batch upload** - 20 devicestatus via WebSocket
2. **xDrip backfill** - 100 entries via REST
3. **Loop cycle** - devicestatus + treatment in sequence

### 6.2 Regression Tests

The shape-handling test suite validates these requirements:

| Test File | Coverage |
|-----------|----------|
| `api.shape-handling.test.js` | REST API input/output shapes |
| `websocket.shape-handling.test.js` | WebSocket dbAdd handling |
| `storage.shape-handling.test.js` | Storage layer normalization |

---

## 7. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 2026 | Nightscout Team | Initial specification |
| 1.1 | October 2026 | Mary (analyst) | Added 4.4: AAPS NSClient v3 with v1 uploader (xDrip+) |

---

## 8. References

- [AAPS Documentation](https://androidaps.readthedocs.io/)
- [Loop Documentation](https://loopkit.github.io/loopdocs/)
- [xDrip+ Documentation](https://xdrip.readthedocs.io/)
- [Data Shape Requirements](./data-shape-requirements.md)
- [API Layer Audit](../audits/api-layer-audit.md)
