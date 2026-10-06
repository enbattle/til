---
title: JSON Web Tokens (JWT)
summary: A signed token a server can verify without a lookup, set against the session cookie it competes with, with what each costs in revocation, scale and attack surface.
date: 2026-09-14
---

Say you run a notes app. Priya logs in, and her next request, a few seconds
later, may land on any of your three API servers. Each server has to answer
one question without asking her again: who is this? There are two standard
answers, and the rest of this page is the difference between them.

## Answer one: a session

On login the server creates a **session**, a record saying "this is Priya",
stored in memory, Redis or a table. It sends back an opaque random ID in a
cookie. On every request the browser attaches the cookie, and the server looks
the ID up to find out who is calling.

That lookup is the cost. All three servers need the same session store, or a
[load balancer](/systems-and-infrastructure/forward-vs-reverse-proxy) has to
send Priya back to the one server holding her session ("sticky sessions").
The payoff is control: delete the record and she is logged out instantly.

## Answer two: a signed token

What if the server skipped the lookup? On login it could hand Priya a **JSON
Web Token** (JWT) instead: a small statement of who she is, signed so nobody
can alter it. A JWT is three parts joined by dots, `header.payload.signature`,
each encoded in **base64url** (base64 text encoding with `+` and `/` replaced by `-` and `_`
and the `=` padding dropped, so it is safe in a URL). Decoded, the payload is JSON:

```json
{
  "sub": "user_42",
  "role": "admin",
  "iat": 1735689600,
  "exp": 1735693200
}
```

Priya's client sends the token on each request, usually as
`Authorization: Bearer <token>`. The server checks the signature against the
header and payload with its key. If it checks out, the payload is untampered and
came from someone holding the signing key. Nothing is looked up, so any of the
three servers can check it. The signature is made one of two ways:

- **HMAC** is _symmetric_: one secret key both signs and verifies, so every
  service that verifies tokens must hold that secret.
- **RSA or ECDSA** is _asymmetric_: a private key signs, and a separate public
  key verifies. The public key can be handed out freely, since it can confirm a
  token but never make one.

A JWT is signed, not encrypted. Anyone holding Priya's token can read every
claim in it, so keep secrets out of the payload.

## What does statelessness cost?

Revocation. The token is valid until its `exp` time, and no database says
otherwise. If Priya's laptop is stolen, you cannot log her out. The fixes put
state back: a short `exp` (say 15 minutes) with a longer-lived **refresh
token** that is checked against the database whenever a new JWT is issued, a
denylist of revoked token IDs, or a per-user version number you check on
sensitive actions.

The token also rides on every request, and it is far larger than a session ID,
often several hundred bytes against a few dozen.

## Where does the token live?

The two answers differ in how they travel, and that decides the attack surface.

|                     | Session + cookie                   | Signed token                            |
| ------------------- | ---------------------------------- | --------------------------------------- |
| Revocation          | Instant: delete the record         | Hard: valid until `exp`                 |
| Server state        | A shared store, or sticky sessions | None: verify with a key                 |
| Default transport   | Cookie, sent automatically         | Header, attached by your code           |
| Main attack surface | [CSRF](/security/csrf)             | [XSS](/security/xss), if JS can read it |
| Fits best           | One server-rendered app            | APIs, mobile apps, other domains        |

A cookie rides along on cross-site requests, so session auth needs CSRF
defences such as `SameSite`. A token in a header is not attached
automatically, so it is immune to CSRF. But if the client keeps it in
`localStorage` so JS can attach it, any XSS payload can read it and send it to
an attacker. Whoever holds the token is Priya, which is why it is called a
**bearer token**. Send it only over TLS and keep `exp` short.

## Can the token lie about how to verify it?

It can try. The header's `alg` field names the signing algorithm, and a naive
verifier trusts it. Set `alg` to `none` and some libraries skip signature
checking, accepting any payload. Or take a server that signs with RSA, whose
public key is published. An attacker sets `alg` to HMAC and signs a forged
token using that public key as the HMAC secret. A verifier that branches on the
incoming `alg` recomputes the HMAC with the key it already has for RSA, and
accepts it. Both attacks have hit real libraries. The fix is to hardcode the
expected algorithm in server code and reject any token that names another. A
valid signature also doesn't mean the token is meant for you, so check `exp`,
the issuer (`iss`) and the audience (`aud`) too.

## Choosing for Priya's app

- **One server-rendered backend:** sessions. They are simpler, and logout works.
- **A single-page app or mobile client calling several APIs, or services
  calling each other:** tokens, because statelessness and cross-domain use
  outweigh the revocation gap. Identity tokens from an external login provider
  are JWTs too; see [OAuth and OIDC](/security/oauth-oidc).
- **A hybrid:** a short-lived JWT in an `HttpOnly`, `SameSite` cookie. JS
  cannot read it, so XSS cannot steal it, the browser attaches it, and the
  short lifetime bounds the revocation gap.

**Rule of thumb.** A JWT trades instant revocation for freedom from shared
state, so reach for one only when many services or domains must verify
identity, and keep it short-lived; otherwise a session cookie is simpler and
safer.
