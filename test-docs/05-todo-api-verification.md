# TODO CRUD API - Verification Document

**Project:** todo-api
**Location:** `C:\Users\zbonham\todo-api\`
**Language:** Python (FastAPI + SQLite)
**Purpose:** Full CRUD REST API for managing todo items with input validation and error handling

---

## Prerequisites

- Python 3.10+ installed
- Virtual environment with dependencies (FastAPI, uvicorn, pydantic, httpx, pytest, pytest-asyncio)

---

## What the API Does

A REST API for managing todos backed by SQLite:

| Method | Endpoint | Description | Status Code |
|--------|----------|-------------|-------------|
| POST | `/todos` | Create a new todo | 201 Created |
| GET | `/todos` | List all todos (optional `?completed=true/false` filter) | 200 OK |
| GET | `/todos/{id}` | Get a single todo by ID | 200 OK / 404 |
| PUT | `/todos/{id}` | Update a todo (partial update) | 200 OK / 404 |
| DELETE | `/todos/{id}` | Delete a todo | 204 No Content / 404 |

### Input Validation (Pydantic)
- `title`: required, 1-200 characters, cannot be blank/whitespace-only
- `description`: optional, max 1000 characters
- `completed`: optional boolean (for updates)

---

## Setup

```
cd C:\Users\zbonham\todo-api
```

If `.venv` already exists:
```
.venv\Scripts\activate
```

If starting fresh:
```
python -m venv .venv
.venv\Scripts\activate
pip install fastapi uvicorn pydantic httpx pytest pytest-asyncio
```

---

## Automated Tests

### Run All Tests (23 total)

**Command:**
```
cd C:\Users\zbonham\todo-api
.venv\Scripts\python -m pytest tests/ -v
```

**Expected Output:** All 23 tests pass. Tests cover:
- Create: valid todo (201), missing title (422), title too long (422)
- List: empty returns [], create 3 then list returns 3, filter by completed
- Get: existing (200), nonexistent (404)
- Update: title only, completed flag, nonexistent (404)
- Delete: existing (204), nonexistent (404), deleted not in list
- Validation: empty title, title > 200 chars, description > 1000 chars

**Pass Criteria:** `23 passed` with no failures.

---

## Manual Verification Steps

### Step 1: Start the Server

**Command:**
```
cd C:\Users\zbonham\todo-api
.venv\Scripts\python -m todo_api
```

**Expected Console Output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

Leave this running. Open a second terminal for the following tests.

**Swagger UI:** Open `http://localhost:8000/docs` in a browser to see interactive API documentation.

---

### Test 1: Create a Todo

**Command:**
```
curl -X POST http://localhost:8000/todos -H "Content-Type: application/json" -d "{\"title\": \"Buy groceries\", \"description\": \"Milk, eggs, bread\"}"
```

**Expected Response (201):**
```json
{
  "id": 1,
  "title": "Buy groceries",
  "description": "Milk, eggs, bread",
  "completed": false,
  "created_at": "2026-03-11T...",
  "updated_at": "2026-03-11T..."
}
```

**Verify:** `id` is 1, `completed` is false, timestamps are ISO 8601.

---

### Test 2: Create a Second Todo

**Command:**
```
curl -X POST http://localhost:8000/todos -H "Content-Type: application/json" -d "{\"title\": \"Walk the dog\"}"
```

**Expected:** 201 response with `id: 2`, `description: null`.

---

### Test 3: List All Todos

**Command:**
```
curl http://localhost:8000/todos
```

**Expected:** JSON array with 2 items (the todos from Tests 1 and 2).

---

### Test 4: Get a Single Todo

**Command:**
```
curl http://localhost:8000/todos/1
```

**Expected:** JSON object for "Buy groceries" todo.

---

### Test 5: Get Nonexistent Todo (404)

**Command:**
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/todos/999
```

**Expected Output:**
```
404
```

**Full response body:**
```
curl http://localhost:8000/todos/999
```

**Expected:**
```json
{"detail": "Todo with id 999 not found."}
```

---

### Test 6: Update a Todo — Mark as Completed

**Command:**
```
curl -X PUT http://localhost:8000/todos/1 -H "Content-Type: application/json" -d "{\"completed\": true}"
```

**Expected:** 200 response with `completed: true`, `title` and `description` unchanged, `updated_at` is newer than `created_at`.

---

### Test 7: Update a Todo — Change Title Only

**Command:**
```
curl -X PUT http://localhost:8000/todos/2 -H "Content-Type: application/json" -d "{\"title\": \"Walk the cat\"}"
```

**Expected:** 200 response with `title: "Walk the cat"`, all other fields unchanged.

---

### Test 8: Update Nonexistent Todo (404)

**Command:**
```
curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:8000/todos/999 -H "Content-Type: application/json" -d "{\"title\": \"test\"}"
```

**Expected Output:**
```
404
```

---

### Test 9: Filter by Completed Status

**Command:**
```
curl "http://localhost:8000/todos?completed=true"
```

**Expected:** Array with only the "Buy groceries" todo (marked complete in Test 6).

**Command:**
```
curl "http://localhost:8000/todos?completed=false"
```

**Expected:** Array with only the "Walk the cat" todo.

---

### Test 10: Delete a Todo

**Command:**
```
curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:8000/todos/1
```

**Expected Output:**
```
204
```

**Verify it's gone:**
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/todos/1
```

**Expected:**
```
404
```

---

### Test 11: Delete Nonexistent Todo (404)

**Command:**
```
curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:8000/todos/999
```

**Expected Output:**
```
404
```

---

### Test 12: Validation — Empty Title (422)

**Command:**
```
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/todos -H "Content-Type: application/json" -d "{\"title\": \"\"}"
```

**Expected Output:**
```
422
```

---

### Test 13: Validation — Title Too Long (422)

**Command (title with 201 characters):**
```
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/todos -H "Content-Type: application/json" -d "{\"title\": \"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}"
```

**Expected Output:**
```
422
```

---

### Test 14: Validation — Missing Title (422)

**Command:**
```
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/todos -H "Content-Type: application/json" -d "{\"description\": \"no title\"}"
```

**Expected Output:**
```
422
```

---

### Cleanup

Press `Ctrl+C` in the terminal running the server to stop it. The `todos.db` SQLite file can be deleted to reset the database.

---

## Summary Checklist

| # | Test | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| A | Automated tests (23) | All pass | |
| 1 | Create todo | 201, returns todo with id | |
| 2 | Create second todo | 201, id increments | |
| 3 | List all todos | 200, array of 2 | |
| 4 | Get todo by ID | 200, correct todo | |
| 5 | Get nonexistent | 404 with detail message | |
| 6 | Update completed | 200, completed=true | |
| 7 | Update title only | 200, only title changed | |
| 8 | Update nonexistent | 404 | |
| 9 | Filter by completed | Correct filtered results | |
| 10 | Delete todo | 204, then 404 on re-fetch | |
| 11 | Delete nonexistent | 404 | |
| 12 | Empty title | 422 | |
| 13 | Title too long | 422 | |
| 14 | Missing title | 422 | |

**Tester Name:** ___________________
**Date Tested:** ___________________
**Overall Result:** PASS / FAIL
