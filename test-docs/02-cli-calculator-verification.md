# CLI Calculator - Verification Document

**Project:** calculator
**Location:** `C:\Users\zbonham\calculator\`
**Language:** Python (stdlib only, pytest for tests)
**Purpose:** Command-line calculator supporting add, subtract, multiply, divide

---

## Prerequisites

- Python 3.10+ installed
- pytest installed (`pip install pytest`)

---

## What the Project Does

A CLI calculator invoked as `python -m calculator <operation> <a> <b>`. Supports four operations: add, subtract, multiply, divide. Handles division by zero gracefully.

---

## Automated Tests

### Run All Tests (40 total)

**Command:**
```
cd C:\Users\zbonham\calculator
python -m pytest tests/ -v
```

**Expected Output:** All 40 tests pass. Tests cover:
- 26 unit tests (`tests/test_calc.py`) — all 4 math operations with zero, negatives, floats, large numbers, division by zero error
- 14 CLI tests (`tests/test_cli.py`) — 7 via direct function call, 7 via subprocess end-to-end

**Pass Criteria:** `40 passed` with no failures or errors.

---

## Manual Verification Steps

### Test 1: Addition

**Command:**
```
python -m calculator add 2 3
```

**Expected Output:**
```
5.0
```

---

### Test 2: Subtraction

**Command:**
```
python -m calculator subtract 10 4
```

**Expected Output:**
```
6.0
```

---

### Test 3: Multiplication

**Command:**
```
python -m calculator multiply 6 7
```

**Expected Output:**
```
42.0
```

---

### Test 4: Division

**Command:**
```
python -m calculator divide 15 3
```

**Expected Output:**
```
5.0
```

---

### Test 5: Division by Zero

**Command:**
```
python -m calculator divide 10 0
```

**Expected Output (stderr):**
```
Error: Cannot divide by zero
```

**Expected Exit Code:** 1 (non-zero indicates error)

To verify exit code on Windows:
```
python -m calculator divide 10 0
echo %ERRORLEVEL%
```
Should print `1`.

---

### Test 6: Decimal Numbers

**Command:**
```
python -m calculator add 1.5 2.7
```

**Expected Output:**
```
4.2
```

---

### Test 7: Negative Numbers

**Command:**
```
python -m calculator subtract -5 3
```

**Expected Output:**
```
-8.0
```

---

### Test 8: Invalid Operation

**Command:**
```
python -m calculator modulo 5 3
```

**Expected Behavior:** Prints argparse error message showing valid choices (add, subtract, multiply, divide). Exit code 2.

---

### Test 9: Missing Arguments

**Command:**
```
python -m calculator add 5
```

**Expected Behavior:** Prints argparse error about missing argument. Exit code 2.

---

## Summary Checklist

| # | Test | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| A | Automated tests (40) | All pass | |
| 1 | add 2 3 | 5.0 | |
| 2 | subtract 10 4 | 6.0 | |
| 3 | multiply 6 7 | 42.0 | |
| 4 | divide 15 3 | 5.0 | |
| 5 | divide 10 0 | Error message, exit code 1 | |
| 6 | add 1.5 2.7 | 4.2 | |
| 7 | subtract -5 3 | -8.0 | |
| 8 | Invalid operation | Argparse error, exit code 2 | |
| 9 | Missing arguments | Argparse error, exit code 2 | |

**Tester Name:** ___________________
**Date Tested:** ___________________
**Overall Result:** PASS / FAIL
