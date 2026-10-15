---
title: JSON Web Tokens (JWT)
summary: A signed token a server can verify without a lookup, set against the session cookie it competes with, with what each costs in revocation, scale and attack surface.
date: 2026-09-14
---

Say you run a notes app with three API servers behind a [load balancer](/systems-and-infrastructure/forward-vs-reverse-proxy), which spreads requests across them. Priya logs in, and her next request, a few seconds later, may land on any of the three. Each server has to answer one question without asking her to log in again: who is this?

This page covers the standard answer and its lookup, a token that skips the lookup, what that costs, and where the token should live.

## The obvious answer: a session

On login the server writes a record saying "this is Priya", in memory, Redis or a table, and sends back a random ID in a cookie. The browser attaches that cookie to every request, and the server looks the ID up to find out who is calling. A record like this is a **session**.

The lookup is the cost: all three servers need the same store, or the load balancer must send Priya back to the one server holding her record ("sticky sessions"). The payoff is control: delete the record and she is logged out at once.

Could the server skip the store and put "user_42" in the cookie? Priya could edit it to "user_1". The claim must resist unnoticed edits.

## Signing the claim

Suppose the server mixes a secret key into a fingerprint of the claim. That fingerprint is the **signature**, and the keyed recipe is an **HMAC** (see [encoding, hashing and encryption](/computing-fundamentals/encoding-hashing-and-encryption)). Change one character of the claim and the fingerprint no longer matches, and forging a new one needs the key. Any server with the key recomputes and compares, with no lookup.

A claim plus its signature, in a standard layout, is a **JSON Web Token** (JWT): `header.payload.signature`, joined by dots. The header names the signing algorithm, and the payload holds the claims as JSON:

```json
{
  "sub": "user_42",
  "role": "admin",
  "iat": 1735689600,
  "exp": 1735693200
}
```

Here `sub` is the subject, `iat` the issue time and `exp` the expiry, as seconds-since-1970 timestamps. Each part is **base64url**-encoded: [Base64](/computing-fundamentals/encoding-hashing-and-encryption) with `-` and `_` in place of `+` and `/`, and no `=` padding, so it is safe inside a URL. Priya's client sends the token as `Authorization: Bearer <token>`, and any of the three servers can check it.

A signature hides nothing, and encoding is not encryption, so anyone holding Priya's token can read every claim. Keep secrets out of the payload.

Signing has two flavors. With HMAC, one shared key signs and verifies, so every service that checks tokens must hold the secret. With **RSA** or **ECDSA**, a private key makes the signature and a public key checks it, and the public key can go to every service: it confirms tokens but cannot make them.

The lookup is gone. So is something else.

## What keeping no record costs

The server now keeps no record of Priya (it is **stateless**), so the token is valid until its `exp`. If her laptop is stolen, you cannot log her out: cancelling a token early, **revocation**, needs state. The fixes put it back:

- A short `exp`, say 15 minutes, with a longer-lived **refresh token** that is checked against the database whenever a new JWT is issued. A stolen JWT then works at most 15 minutes.
- A denylist of revoked token IDs.
- A per-user version number, checked on sensitive actions.

Size is the other cost, because the token rides on every request:

```text
header     {"alg":"HS256","typ":"JWT"}   27 bytes  → 27 × 4 ÷ 3 = 36 characters
payload    the claims above              66 bytes  → 66 × 4 ÷ 3 = 88 characters
signature  HMAC-SHA256 output            32 bytes  → 32 × 4 ÷ 3 ≈ 43 characters
two dots                                              2 characters
total                                                 169 characters
```

Base64 turns every 3 bytes into 4 characters, hence the × 4 ÷ 3. The signature rounds up because base64url drops the `=` padding: 32 bytes gives 43 characters, not 44. A session ID of 16 random bytes is 32 hex characters, so the token is 169 ÷ 32 ≈ 5 times larger, and real tokens with more claims reach several hundred bytes.

The two answers also differ in how they travel, which decides what an attacker can reach.

## Where the token lives

|                     | Session + cookie           | Signed token                            |
| ------------------- | -------------------------- | --------------------------------------- |
| Default transport   | Cookie, sent automatically | Header, attached by your code           |
| Main attack surface | [CSRF](/security/csrf)     | [XSS](/security/xss), if JS can read it |

A cookie rides along on cross-site requests, so session auth needs CSRF defences such as `SameSite`. A token in a header is not attached automatically, so it is immune to CSRF. But if the client keeps it in `localStorage` so JS can attach it, any XSS payload can read it and send it to an attacker. Whoever holds it is Priya, hence **bearer token**. Send it only over TLS.

One question remains: should the server believe what the token says about itself?

## Can the token lie about how to verify it?

The header's `alg` field names the signing algorithm, and a naive verifier trusts it. Set `alg` to `none` and some libraries skip signature checking, accepting any payload. Or take a server that signs with RSA, whose public key is published. An attacker sets `alg` to HMAC and signs a forged token using that public key as the HMAC secret. A verifier that branches on `alg` recomputes the HMAC with that key and accepts it. Both have hit real libraries.

The fix is to hardcode the expected algorithm in server code and reject any token that names another. A valid signature also doesn't mean the token is meant for you, so check `exp`, the issuer (`iss`) and the audience (`aud`) too. So which answer fits Priya's app?

## Choosing for Priya's app

- **One server-rendered backend:** sessions. They are simpler, and logout works.
- **A single-page app or mobile client calling several APIs, or services calling each other:** tokens, because statelessness and cross-domain use outweigh the revocation gap. Identity tokens from an external login provider are JWTs too; see [OAuth and OIDC](/security/oauth-oidc).
- **A hybrid:** a short-lived JWT in an `HttpOnly`, `SameSite` cookie. The browser attaches it, JS cannot read it, so XSS cannot steal it, and the short lifetime bounds the revocation gap.

**Rule of thumb.** A JWT trades instant revocation for freedom from shared state, so reach for one only when many services or domains must verify identity, and keep it short-lived; otherwise a session cookie is simpler and safer.
