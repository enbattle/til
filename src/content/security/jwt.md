---
title: JSON Web Tokens (JWT)
summary: A signed, self-contained token a server can verify without a database lookup — what that buys you, and the ways it's misused.
date: 2026-09-14
---

A JSON Web Token is three parts joined by dots — `header.payload.signature`
— each part encoded with **base64url** (a variant of base64 text encoding
that's safe to put directly in a URL, since it avoids the `+`, `/`, and
`=` characters plain base64 uses). The header and payload are JSON
objects; the signature is the raw output of the signing operation, not
JSON.

```json
// payload (the middle part) — decoded
{
  "sub": "user_42",
  "role": "admin",
  "iat": 1735689600,
  "exp": 1735693200
}
```

The signature covers the header and payload, computed one of two ways:

- **HMAC** — a _symmetric_ algorithm: the same secret key both creates
  the signature and checks it, the way a padlock and its one matching key
  both lock and unlock it. Every service that needs to verify a token has
  to hold that same secret.
- **RSA or ECDSA** — an _asymmetric_ algorithm: a private key creates the
  signature, and a separate public key checks it. The public key can be
  handed out freely — anyone with it can confirm a token is genuine, but
  only the holder of the private key could have produced it.

Either way, anyone holding the right key (secret or public) can verify
that the payload is untampered and was issued by someone who holds the
signing key — **without a database lookup**. Note what the signature does
_not_ do: a JWT is signed, not encrypted. Anyone who has the token can
read every claim in it. Never put secrets in the payload.

## What "no database lookup" actually buys you

A client logs in once and gets back a signed token; from then on, any
service that holds the signing key can verify that token locally, with no
round-trip to a central session store on every request. That's convenient
for microservices and for scaling horizontally behind a load balancer:
with a session store, the load balancer has to keep routing a given user
to the same backend instance that holds their session ("sticky
sessions"), or every instance needs access to a shared store. Stateless
verification needs neither — any instance holding the signing key can
handle any request.

## What that same statelessness costs you

- **Revocation is hard.** A signed token is valid until it expires. There's
  no "log out everywhere" without adding state back — a short `exp` plus
  refresh tokens, a denylist of revoked IDs, or a per-user token version
  you check on sensitive actions.
- **Algorithm attacks.** The `alg` field in the header names which
  algorithm the signature uses — and a naive verifier that just trusts it
  is exploitable. Set `alg` to `none` and some libraries skip signature
  checking entirely, accepting any payload as valid. Or take a server that
  signs with RSA (public key openly available) and trick a verifier that
  branches on the incoming `alg` field into treating that same public key
  as an _HMAC_ secret instead — since HMAC verification just re-computes
  the signature with the key it's given, the attacker can forge a
  perfectly valid-looking HMAC signature using the public key everyone
  already has. Both are real, previously-exploited vulnerabilities. The
  fix is to never let the token pick its own verification method: hardcode
  the expected algorithm server-side and reject anything else, rather than
  branching on whatever `alg` the incoming token claims.
- **Size.** A JWT is far larger than an opaque session ID and rides on
  every request.

## Treat it as a bearer token, because that's what it is

Whoever holds the token can use it. Keep `exp` short, send it only over
TLS, and store it with care: a token in `localStorage` is readable by any
[XSS](/security/xss) payload, while an `HttpOnly` cookie can't be read by
JS but then needs [CSRF](/security/csrf) defenses. There's no storage
location that's free of tradeoffs.

API access tokens, service-to-service auth, and identity tokens issued by
an external login provider are where a JWT earns its keep. For a classic
server-rendered web app with one backend, a session cookie is usually
simpler and gives you instant revocation — see
[Session vs. Token Authentication](/security/session-vs-token-auth).
