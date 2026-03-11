# Express.js API - Verification Document

**Project:** express-api
**Location:** `C:\Users\zbonham\express-api\`
**Language:** Node.js (Express.js)
**Purpose:** Basic REST API with health check endpoint

---

## Prerequisites

- Node.js 18+ installed
- npm installed

---

## What the Project Does

A minimal Express.js API with two endpoints:
- `GET /` — Returns a welcome message
- `GET /health` — Returns server health status (uptime, timestamp)

---

## Setup

If `node_modules/` is not present, install dependencies first:
```
cd C:\Users\zbonham\express-api
npm install
```

---

## Automated Tests

### Run All Tests (7 total)

**Command:**
```
cd C:\Users\zbonham\express-api
npm test
```

**Expected Output:** All 7 tests pass. Tests cover:
- `GET /health` — returns 200, status "ok", numeric uptime, valid ISO timestamp
- `GET /` — returns 200, message present
- `GET /nonexistent` — returns 404

**Pass Criteria:** `7 passed` with no failures.

---

## Manual Verification Steps

### Step 1: Start the Server

**Command:**
```
cd C:\Users\zbonham\express-api
node src/index.js
```

**Expected Console Output:**
```
Server running on port 3000
```

Leave this terminal running. Open a second terminal for the following tests.

---

### Test 1: Root Endpoint

**Command:**
```
curl http://localhost:3000/
```

**Expected Output:**
```json
{"message":"Express API is running"}
```

---

### Test 2: Health Check Endpoint

**Command:**
```
curl http://localhost:3000/health
```

**Expected Output (example):**
```json
{
  "status": "ok",
  "uptime": 12.345,
  "timestamp": "2026-03-11T20:00:00.000Z"
}
```

**Verify:**
- `status` is `"ok"`
- `uptime` is a positive number (seconds since server started)
- `timestamp` is a valid ISO 8601 date string

---

### Test 3: Unknown Route Returns 404

**Command:**
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/nonexistent
```

**Expected Output:**
```
404
```

---

### Test 4: Custom Port via Environment Variable

**Command (stop the previous server first with Ctrl+C):**
```
set PORT=4000
node src/index.js
```

**Expected Console Output:**
```
Server running on port 4000
```

**Then verify:**
```
curl http://localhost:4000/health
```

Should return the health JSON as in Test 2.

---

### Cleanup

Press `Ctrl+C` in the terminal running the server to stop it.

---

## Summary Checklist

| # | Test | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| A | Automated tests (7) | All pass | |
| 1 | GET / | `{"message":"Express API is running"}` | |
| 2 | GET /health | JSON with status, uptime, timestamp | |
| 3 | GET /nonexistent | HTTP 404 | |
| 4 | Custom PORT env var | Server runs on specified port | |

**Tester Name:** ___________________
**Date Tested:** ___________________
**Overall Result:** PASS / FAIL
