---
title: Session vs. Token Authentication
summary: A server-side session and cookie costs you differently than a stateless signed token in revocation, scale, and CSRF exposure.
date: 2026-09-14
---

Two ways to keep a user logged in across stateless HTTP requests:

- **Session auth** — on login the server creates a session record (in
  memory, Redis, or a table) and hands the client an opaque session ID in a
  cookie. Every request, the server looks the ID up to find out who's
  calling.
- **Token auth** — on login the server returns a signed token (usually a
  [JWT](/security/jwt)). The client stores it and sends it on each request,
  typically as `Authorization: Bearer <token>`. The server verifies the
  signature; there's nothing to look up.

## One transport choice explains every other difference

|                                       | Session + cookie                                                                                                      | Signed token                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Revocation                            | Instant — delete the record                                                                                           | Hard — valid until `exp`                            |
| Server state                          | A session store — shared across servers, or "sticky sessions" routing each user back to the one server holding theirs | None — verify with a key                            |
| Horizontal scale                      | Needs the shared store                                                                                                | Trivial                                             |
| Default transport                     | Cookie, sent automatically                                                                                            | Header, sent explicitly                             |
| Main attack surface                   | [CSRF](/security/csrf) — needs `SameSite` / tokens                                                                    | [XSS](/security/xss) if stored where JS can read it |
| Size on the wire                      | Tiny ID                                                                                                               | Whole token, every request                          |
| Cross-domain / mobile / 3rd-party API | Awkward                                                                                                               | Natural fit                                         |

The cookie-vs-header split drives the security difference. A cookie rides
along on cross-site requests, so session auth needs CSRF defense. A token
in a header doesn't ride along automatically — CSRF-immune — but if you
keep it in `localStorage` for JS to attach, any XSS can steal it.

## Picking one for the shape of the app in front of you

- **Server-rendered web app, one backend** → sessions. Simpler, and you get
  real logout for free.
- **SPA or mobile app talking to one or more APIs, or service-to-service**
  → tokens. Statelessness and cross-origin use are worth the revocation
  cost.
- **Hybrid** → a short-lived token delivered in an `HttpOnly`, `SameSite`
  cookie: no JS access (XSS-safe), no manual attaching, and the short
  lifetime bounds the revocation gap.

It's revocation vs. statelessness, in the end. Don't reach for a JWT
because it's fashionable when a session cookie would serve a
single-backend app better; don't force server-side sessions onto a fleet
of APIs that would rather not share a store.
