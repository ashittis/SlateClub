# auth components — form fields for login/signup

Shared form primitives for the authentication screens.

## Components
- **`AuthField.tsx`** — a styled, labelled input used across the login and signup forms
  (handles focus states, validation display, and the cinema-dark styling).

## Notes
- Fields are used by the `(auth)/login` and `(auth)/signup` pages; submission hits the
  `auth` endpoints (which set the JWT cookie).
