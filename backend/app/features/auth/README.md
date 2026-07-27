# auth — signup, login, sessions

Account creation and authentication. Issues JWTs stored in cookies; the actual
token-verification dependency lives in `core/auth.py` and is reused by every other route.

## Files
- **`routes.py`** — `signup`, `login`, `logout`, and "who am I" endpoints. Hashes passwords,
  mints a JWT, and sets it as an auth cookie (SameSite handling differs dev vs prod).

## How it works
1. On signup/login the password is verified and a signed JWT is set as an HTTP cookie.
2. Every other route depends on `core.auth.get_current_user`, which reads and validates
   that cookie/token and loads the `User`.

## Talks to
- shared models: `user`
- core: `auth` (token creation/verification), `config` (JWT secret)
