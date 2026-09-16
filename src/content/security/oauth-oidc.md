---
title: OAuth 2.0 & OpenID Connect
summary: Delegated authorization — how a third-party app gets scoped, revocable access to your data without your password — plus what OpenID Connect adds for login.
date: 2026-09-15
---

Say you want to let a third-party app read your calendar. Handing it
your account password would give it _everything_, forever, with no way
to take that access back short of changing the password entirely.
**OAuth 2.0** is the protocol that fixes this: the app instead gets a
limited, revocable **access token** — scoped to something like "read
calendar," expiring in an hour — and never sees the password at all.
It's **delegated authorization**: proving what an app may do, not who a
person is.

## The four roles in every exchange

- **Resource owner** — the user who owns the data.
- **Client** — the app requesting access.
- **Authorization server** — authenticates the user, gets their consent,
  and issues tokens.
- **Resource server** — the API holding the actual data, which accepts
  the token on incoming requests.

## The authorization code flow, step by step

This is the standard flow for web and mobile apps, and — paired with
PKCE, below — the current best practice for essentially every kind of
client:

1. The client redirects the user to the authorization server's
   `/authorize` endpoint, along with its `client_id`, a `redirect_uri`,
   the `scope` it's requesting, a random `state` value, and a PKCE
   `code_challenge`.
2. The user authenticates with the authorization server and approves the
   requested scopes.
3. The authorization server redirects back to the `redirect_uri` with a
   short-lived, single-use **authorization code**.
4. The client exchanges that code — plus the PKCE `code_verifier` it
   generated in step 1 — at the authorization server's `/token` endpoint
   for an **access token**, and usually a refresh token too.
5. The client calls the resource server with
   `Authorization: Bearer <access token>`.

The extra authorization-code step exists specifically so the access
token itself is returned on a back-channel server-to-server request,
never inside a browser URL where it would leak into browser history,
server logs, and `Referer` headers.

**PKCE** (Proof Key for Code Exchange) ties the authorization code to
the specific client that started the flow: the client sends
`code_challenge = hash(code_verifier)` up front in step 1, and the raw
`code_verifier` at exchange time in step 4, so a stolen authorization
code is useless to anyone who doesn't also have the original verifier.
Public clients — single-page apps, mobile apps — have no way to keep a
client secret truly secret, so PKCE is what actually secures them; it's
now recommended for confidential clients too. The **`state`** value is a
random string the client generates and checks matches on return —
[CSRF](/security/csrf) protection for the redirect itself.

## Tokens and scopes

- **Access token** — short-lived (minutes to an hour), scoped to
  specific permissions, sent to the resource server on every call. It
  may be an opaque string or a [JWT](/security/jwt).
- **Refresh token** — long-lived, exchanged at the token endpoint for a
  fresh access token without sending the user back through the consent
  screen. Store it server-side or in secure device storage, and rotate
  it on each use.
- **Scopes** — space-separated permission strings (`calendar.read`).
  Requesting the minimum needed matters twice over: a smaller ask means
  a less alarming consent screen, and a smaller blast radius if the
  token ever leaks.

## What OpenID Connect adds: knowing who, not just what

OAuth 2.0 answers "what may this app do" — authorization. It
deliberately says nothing about "who is this user." **OpenID Connect
(OIDC)** is a thin layer on top that adds authentication:

- an **ID token** — a JWT carrying verified identity claims (`sub`,
  `email`, `name`, issuer, audience) that the client validates directly;
- a `/userinfo` endpoint for fetching more profile detail;
- the `openid` scope, which is what triggers all of the above.

"Log in with [identity provider]" buttons are OIDC. If an application
needs to know who a user actually is, the ID token is the thing to use —
not the access token, which was never meant to answer that question.

## Common mistakes

- **Treating the access token as proof of identity.** It's a capability
  grant, not an ID — inspecting or trusting its contents to answer "who
  is this" is exactly the mistake OIDC's separate ID token exists to
  prevent.
- **Not validating `state` on the redirect back**, which reopens the
  CSRF hole the value was there to close.
- **Skipping PKCE, or embedding a client secret in a single-page app** —
  there's no way to keep a secret hidden inside code running in
  a browser.
- **Letting access tokens live too long.** Lean on short-lived access
  tokens plus refresh tokens, so revoking access actually takes effect
  quickly instead of staying valid until a long expiry finally arrives.

## Where it fits

OAuth and OIDC are the standard answer whenever a genuine third party
needs access to a user's data, or whenever an app wants federated
"log in with…" rather than running its own password database. For
first-party authentication between an application's own frontend and
its own backend, the lighter-weight options in
[Session vs. Token Authentication](/security/session-vs-token-auth) are
often all that's actually needed.
