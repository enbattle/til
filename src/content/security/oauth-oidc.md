---
title: OAuth 2.0 and OpenID Connect
summary: How a third-party app gets scoped, revocable access to your data without ever seeing your password, and what OpenID Connect adds so the same exchange can log you in.
date: 2026-09-15
---

Say a scheduling app called Meetly wants to read your calendar so it can suggest free times. How can it do that without you handing over your password, and how can you take its access back later?

This page shows what the obvious answer, the password, costs, builds the flow that replaces it, closes its two holes, covers how long access lasts, and ends with the step that lets the same flow log you in.

## Why not just give Meetly your password

The password hands Meetly everything, forever: your email, your files, your ability to change the password. The only way to take that access back is to change the password, which breaks every other app you gave it to.

What you want is a spare key that opens one door and that you can cancel alone. That key is an **access token**, a string that means "this app may read this user's calendar until 3:00 p.m." The door it opens is its **scope**, a permission string like `calendar.read`. Ask for the minimum: Meetly only reads events, so it shouldn't request edit permission. A leaked token then does less.

Someone has to check you and issue that key, without Meetly seeing your password.

## Who is involved

Four parties take part:

- **Resource owner**: you, the person who owns the calendar data.
- **Client**: Meetly, the app asking for access.
- **Authorization server**: the service that signs you in, asks for your consent and issues tokens.
- **Resource server**: the calendar API, which accepts a token and returns data.

The protocol that moves a token between them is **OAuth 2.0**. The question is how the token travels.

## How Meetly gets its token

The simplest design sends you to the authorization server, and when you approve, redirects your browser back to Meetly with the access token in the URL. It fails because everything that crosses your browser lands in history, server logs and `Referer` headers (which tell the next site where you came from), where a token is easy to steal.

So the redirect carries something useless on its own, a short-lived, single-use **authorization code**, and Meetly trades it for the token on a direct request. This is the **authorization code flow**, the standard for web and mobile apps:

1. Meetly redirects your browser to the authorization server's `/authorize` endpoint. The URL carries Meetly's `client_id`, a `redirect_uri` to come back to, and the `scope` it wants.
2. You sign in with the authorization server, not with Meetly, and approve the scope.
3. The server redirects your browser back to `redirect_uri` with the authorization code.
4. Meetly's backend sends the code, and its client secret if it has one (a password the backend uses to prove itself), to the server's `/token` endpoint and receives an access token.
5. Meetly calls the calendar API with `Authorization: Bearer <access token>`.

So the browser only carries a code that is worthless without step 4. Two gaps remain.

## Closing two gaps

The first gap: an attacker tricks your browser into completing a flow Meetly never started. The fix is a `state` parameter. Meetly generates a random string in step 1 and checks that it comes back unchanged in step 3. If it doesn't, Meetly drops the response. This is [CSRF](/security/csrf) protection for the redirect.

The second gap: someone steals the code in transit and redeems it first. **PKCE** (Proof Key for Code Exchange, said "pixie") closes it. Before step 1, Meetly makes a random secret string, the `code_verifier`, and keeps it.

In step 1 Meetly sends only a hash of it, a one-way scramble, as the `code_challenge`. In step 4 it sends the raw verifier, and the server hashes it and compares. A thief with the code but not the verifier gets nothing.

PKCE matters most for **public clients**, such as single-page and mobile apps, which can't keep a client secret because anyone can read the code they ship. Use it for every client.

What is left is how long the token should live.

## Short-lived tokens and refresh

An access token lives minutes to an hour, so a leaked one soon stops working. It may be an opaque random string or a [JWT](/security/jwt), which the resource server can check without calling anyone.

To avoid hourly consent, the server also issues a **refresh token**, long-lived and exchanged at `/token` for a fresh access token with no consent screen. Keep it server-side or in secure device storage. Have the server issue a new one on each use (**rotation**), so a stolen copy is detected when both copies are used.

Meetly can read your calendar, but doesn't know who you are.

## From "what" to "who"

OAuth is **delegated authorization**: it proves what an app may do and says nothing about who you are. Suppose Meetly also wants a "Log in with..." button. The access token can't serve, since it isn't defined to carry an identity.

**OpenID Connect** (OIDC) is a thin layer on OAuth 2.0 that adds authentication. Meetly adds the `openid` scope to the same step 1. The token response gains an **ID token**, a JWT of identity claims:

- `sub`, a stable user ID;
- `iss`, who issued the token;
- `aud`, which client it is for;
- often `email` and `name`.

Meetly checks the signature, that `iss` and `aud` match, and that it hasn't expired (`exp`). It can also send the access token to a `/userinfo` endpoint for more profile detail. Google's "Log in with..." button is this. Key your accounts on `iss` plus `sub`, never on email, which can change.

## What goes wrong

- Trusting an access token as proof of identity, the mistake the ID token exists to prevent.
- Skipping the `state` check or PKCE, or shipping a client secret in a single-page app.
- Long-lived access tokens, which make revocation slow.

**Rule of thumb.** Use OAuth when an app needs limited access to data it doesn't own, and add OIDC when it also needs to know who the user is. For a first-party app talking to its own backend, plain [session or token login](/security/jwt) is usually enough.
