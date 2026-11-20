# Two-factor authentication

Every account can require a six-digit code from an authenticator app at sign-in,
on top of its password. The codes are standard TOTP (RFC 6238), so any app that
speaks it works: Google Authenticator, 1Password, Authy, Bitwarden, iOS
Passwords, and so on.

Nothing about 2FA is role-based: it is a property of the person's account, turned
on and off from **Settings → Profile → Two-factor authentication**.

## Turning it on

1. Settings → Profile → *Turn on two-factor*. The backend mints a secret and
   leaves it **pending**; the account behaves exactly as before.
2. Scan the QR code with the app — or type the key by hand. The QR is drawn in
   the browser from the `otpauth://` URI; nothing is sent to a third party.
3. Enter one code from the app. That single check confirms the app and the
   secret match, and only then does 2FA switch on.
4. Ten recovery codes are shown **once**. They are stored hashed, so this is the
   only moment they exist in readable form. Copy or download them.

## Signing in with it

`POST /api/auth/login` still checks the password, but on a 2FA account a correct
password no longer returns a session. It returns a ticket:

```json
{
  "two_factor_required": true,
  "challenge": "<opaque token>",
  "expires_at": "2026-11-20T16:22:41Z",
  "user": { "id": "…", "email": "…", "name": "…" }
}
```

The client then calls `POST /api/auth/login/2fa` with that ticket plus either
`code` (six digits) or `recovery_code`, and gets the ordinary session payload
back.

Guards worth knowing:

| Guard | Why |
| --- | --- |
| The ticket lives 5 minutes | Long enough to unlock a phone, short enough to be junk later |
| A ticket works once | A successful code deletes it |
| Five wrong codes burn the ticket | And each one also counts against the role's lockout policy |
| A time step signs in once | `totp_last_counter` refuses a code replayed inside its own 30-second window |
| ±1 period of clock skew | A phone a few seconds off still works |
| Recovery codes are single use | `used_at` on the row; the count in the UI stays honest |
| The secret is encrypted at rest | AES-256-GCM under its own HKDF label, derived from `AI_ENCRYPTION_SECRET` |

## Turning it off, and the way back in

- **Turn off** and **New recovery codes** both re-check the password: weakening
  an account should cost the same credential as entering it.
- **Reset (administrator)** on the Users page clears the secret and the recovery
  codes for somebody who lost both the app and their codes. It never touches the
  password.
- A secret that cannot be decrypted (rotated `AI_ENCRYPTION_SECRET`) is treated
  as absent, so the owner can enrol again instead of being locked out forever.

## Where the code lives

| Path | What |
| --- | --- |
| `backend/internal/totp/` | TOTP codes, secrets, otpauth URIs, recovery codes (stdlib only, RFC 6238 test vectors) |
| `backend/internal/handler/two_factor.go` | Enrolment, sign-in handshake, recovery codes, reset |
| `backend/internal/handler/auth.go` | Password step; branches to a challenge when 2FA is on |
| `backend/internal/db/migrations/000012_two_factor.up.sql` | `users.totp_*`, `user_recovery_codes`, `two_factor_challenges` |
| `frontend/src/components/profile/TwoFactorCard.tsx` | Settings card, QR enrolment dialog, recovery codes |
| `frontend/src/routes/login.tsx` | The code step of the sign-in form |
| `frontend/src/routes/users.tsx` | Per-user 2FA column and the administrator reset |

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/me/two-factor?user_id=` | `{enabled, enabled_at, pending, recovery_codes_left}` |
| `POST /api/me/two-factor/setup` | Mints a pending secret: `{secret, otpauth_uri, account, issuer, digits, period, algorithm}` |
| `POST /api/me/two-factor/enable` | `{user_id, code}` → turns it on, returns the recovery codes once |
| `POST /api/me/two-factor/disable` | `{user_id, password}` |
| `POST /api/me/two-factor/recovery-codes` | `{user_id, password}` → fresh batch, old one revoked |
| `POST /api/auth/login/2fa` | `{challenge, code}` or `{challenge, recovery_code}` |
| `POST /api/users/{userID}/two-factor/reset` | Administrator clearing another account |

## Testing

```bash
cd backend && go test ./internal/totp/ ./internal/handler/
```

`internal/totp` checks the codes against the published RFC 6238 vectors and the
recovery-code format; `internal/handler` walks enrolment, the sign-in handshake,
replay refusal, recovery codes, lockout and the administrator reset against a
real SQLite database.
