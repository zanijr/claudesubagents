# Fetch Title Script - Verification Document

**Project:** fetch_title.py
**Location:** `C:\Users\zbonham\fetch_title.py`
**Language:** Python (stdlib only)
**Purpose:** Fetches JSON data from httpbin.org and prints the slideshow title

---

## Prerequisites

- Python 3.8+ installed
- Internet access (the script calls an external API)

---

## What the Script Does

1. Makes an HTTP GET request to `https://httpbin.org/json`
2. Parses the JSON response
3. Extracts and prints the `title` field from `data["slideshow"]["title"]`

---

## Verification Steps

### Test 1: Run the Script

**Command:**
```
cd C:\Users\zbonham
python fetch_title.py
```

**Expected Output:**
```
Sample Slide Show
```

**Pass Criteria:** The output is exactly `Sample Slide Show` (the static title returned by httpbin.org).

---

### Test 2: Verify Error Handling (No Internet)

**Command:** Disconnect from the network, then run:
```
python fetch_title.py
```

**Expected Behavior:** The script should raise a `urllib.error.URLError` exception (network unreachable). This is acceptable — the script is a simple utility with no retry logic.

---

## Summary Checklist

| # | Test | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| 1 | Run script with internet | Prints `Sample Slide Show` | |
| 2 | Run script without internet | Raises network error | |

**Tester Name:** ___________________
**Date Tested:** ___________________
**Overall Result:** PASS / FAIL
