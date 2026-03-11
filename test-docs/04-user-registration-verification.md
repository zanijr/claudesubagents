# User Registration Module - Verification Document

**Project:** user-registration
**Location:** `C:\Users\zbonham\user-registration\`
**Language:** Python (stdlib only, pytest for tests)
**Purpose:** Email validation, password hashing (PBKDF2), strength checking, and user registration

---

## Prerequisites

- Python 3.10+ installed
- pytest installed (`pip install pytest`)

---

## What the Module Does

Provides five functions:
1. `validate_email(email)` — Checks email format against simplified RFC 5322 regex
2. `hash_password(password)` — Hashes with PBKDF2-HMAC-SHA256 (600K iterations, 32-byte random salt)
3. `verify_password(password, hashed)` — Timing-safe verification of password against stored hash
4. `validate_password_strength(password)` — Checks min 8 chars, 1 upper, 1 lower, 1 digit, 1 special
5. `register_user(email, password)` — Validates and hashes, returns user dict with email, hash, and timestamp

---

## Automated Tests

### Run All Tests (50 total)

**Command:**
```
cd C:\Users\zbonham\user-registration
python -m pytest tests/ -v
```

**Expected Output:** All 50 tests pass. Tests cover:
- Email validation (valid formats, invalid formats, edge cases)
- Password hashing (not plaintext, unique salts, correct format)
- Password verification (correct password, wrong password, malformed hash)
- Password strength (too short, missing uppercase/lowercase/digit/special)
- User registration (success, invalid email, weak password)

**Pass Criteria:** `50 passed` with no failures.

---

## Manual Verification Steps

Open a Python REPL:
```
cd C:\Users\zbonham\user-registration
python
```

### Test 1: Email Validation — Valid Email

```python
from user_registration import validate_email
print(validate_email("user@example.com"))
```

**Expected:** `True`

---

### Test 2: Email Validation — Invalid Email (No @)

```python
print(validate_email("userexample.com"))
```

**Expected:** `False`

---

### Test 3: Email Validation — Invalid Email (No Domain)

```python
print(validate_email("user@"))
```

**Expected:** `False`

---

### Test 4: Email Validation — Invalid Email (Spaces)

```python
print(validate_email("user @example.com"))
```

**Expected:** `False`

---

### Test 5: Password Hashing

```python
from user_registration import hash_password
h = hash_password("MyP@ssw0rd!")
print(h)
print("$" in h)  # Contains separator
print(h != "MyP@ssw0rd!")  # Not plaintext
```

**Expected:**
- A long hex string with a `$` separator (e.g., `a1b2c3...$d4e5f6...`)
- `True` (contains separator)
- `True` (not plaintext)

---

### Test 6: Different Salts Each Time

```python
h1 = hash_password("same_password")
h2 = hash_password("same_password")
print(h1 == h2)
```

**Expected:** `False` (different random salts produce different hashes)

---

### Test 7: Password Verification — Correct Password

```python
from user_registration import verify_password
h = hash_password("MyP@ssw0rd!")
print(verify_password("MyP@ssw0rd!", h))
```

**Expected:** `True`

---

### Test 8: Password Verification — Wrong Password

```python
print(verify_password("WrongPassword1!", h))
```

**Expected:** `False`

---

### Test 9: Password Strength — Valid Password

```python
from user_registration import validate_password_strength
valid, msg = validate_password_strength("MyStr0ng!Pass")
print(valid, msg)
```

**Expected:** `True Password is strong.`

---

### Test 10: Password Strength — Too Short

```python
valid, msg = validate_password_strength("Ab1!")
print(valid, msg)
```

**Expected:** `False Password must be at least 8 characters long.`

---

### Test 11: Password Strength — No Uppercase

```python
valid, msg = validate_password_strength("mypassw0rd!")
print(valid, msg)
```

**Expected:** `False Password must contain at least one uppercase letter.`

---

### Test 12: Password Strength — No Special Character

```python
valid, msg = validate_password_strength("MyPassw0rd")
print(valid, msg)
```

**Expected:** `False Password must contain at least one special character.`

---

### Test 13: Register User — Success

```python
from user_registration import register_user
user = register_user("test@example.com", "MyStr0ng!Pass")
print(user.keys())
print(user["email"])
print("$" in user["password_hash"])
print("T" in user["created_at"])  # ISO 8601 format
```

**Expected:**
```
dict_keys(['email', 'password_hash', 'created_at'])
test@example.com
True
True
```

---

### Test 14: Register User — Invalid Email

```python
try:
    register_user("not-an-email", "MyStr0ng!Pass")
except ValueError as e:
    print(e)
```

**Expected:** `Invalid email address: 'not-an-email'`

---

### Test 15: Register User — Weak Password

```python
try:
    register_user("test@example.com", "weak")
except ValueError as e:
    print(e)
```

**Expected:** `Password must be at least 8 characters long.`

---

## Security Notes for Reviewer

- Passwords are hashed with PBKDF2-HMAC-SHA256 at 600,000 iterations (OWASP recommended)
- 32-byte random salt generated with `secrets.token_bytes()` (CSPRNG)
- Verification uses `secrets.compare_digest()` to prevent timing attacks
- No passwords are ever stored or logged in plaintext

---

## Summary Checklist

| # | Test | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| A | Automated tests (50) | All pass | |
| 1 | Valid email | True | |
| 2 | No @ symbol | False | |
| 3 | No domain | False | |
| 4 | Has spaces | False | |
| 5 | Hash output format | Hex$hex, not plaintext | |
| 6 | Different salts | Two hashes differ | |
| 7 | Verify correct pw | True | |
| 8 | Verify wrong pw | False | |
| 9 | Strong password | True | |
| 10 | Too short | False with message | |
| 11 | No uppercase | False with message | |
| 12 | No special char | False with message | |
| 13 | Register success | Dict with email, hash, timestamp | |
| 14 | Register bad email | ValueError | |
| 15 | Register weak pw | ValueError | |

**Tester Name:** ___________________
**Date Tested:** ___________________
**Overall Result:** PASS / FAIL
