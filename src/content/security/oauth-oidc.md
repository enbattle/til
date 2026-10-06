---
title: OAuth 2.0 and OpenID Connect
summary: How a third-party app gets scoped, revocable access to your data without ever seeing your password, and what OpenID Connect adds so the same exchange can log you in.
date: 2026-09-15
---

Say a scheduling app called Meetly wants to read your calendar so it can suggest free times. The obvious way is to give Meetly your calendar password. That hands it everything, forever: your email, your files, your ability to change the password. The only way to take that access back is to change the password, which breaks every other app you gave it to.

**OAuth 2.0** is the protocol that fixes this. Meetly never sees your password. Instead it receives an **access token**, a string that means "this app may read this user's calendar until 3:00 p.m." You can revoke it without touching your password. OAuth is **delegated authorization**: it proves what an app may do, and says nothing about who you are. Hold that thought, because the second half of this page fixes it.

## Who is involved

Every OAuth exchange has four roles. In our example:

- **Resource owner**: you, the person who owns the calendar data.
- **Client**: Meetly, the app asking for access.
- **Authorization server**: the service that signs you in, asks for your consent and issues tokens.
- **Resource server**: the calendar API, which accepts a token and returns data.

## How Meetly gets its token

How does Meetly get a token without touching your password? It sends you to the authorization server and lets that server do the talking. This is the **authorization code flow**, the standard choice for web and mobile apps:

1. Meetly redirects your browser to the authorization server's `/authorize` endpoint. The URL carries Meetly's `client_id`, a `redirect_uri` to come back to, the `scope` it wants (`calendar.read`), a random `state` value and a PKCE `code_challenge` (both explained below).
2. You sign in with the authorization server, not with Meetly, and approve the scope.
3. The server redirects your browser back to Meetly's `redirect_uri` with a short-lived, single-use **authorization code**.
4. Meetly's backend sends that code, plus the PKCE `code_verifier`, to the server's `/token` endpoint and receives an access token, usually with a refresh token.
5. Meetly calls the calendar API with `Authorization: Bearer <access token>`.

Why the detour through a code? Everything in steps 1 to 3 travels through your browser, in URLs that end up in history, server logs and `Referer` headers. A code in that URL is nearly harmless, because it is useless without step 4. The access token never travels in a browser URL; it comes back on the direct request in step 4.

Two details close the remaining gaps. The `state` value is a random string Meetly generates in step 1 and checks on return. If an attacker tricks your browser into completing a flow Meetly never started, the check fails, which is [CSRF](/security/csrf) protection for the redirect.

**PKCE** (Proof Key for Code Exchange, said "pixie") protects the code itself. Before step 1, Meetly makes a random `code_verifier` and sends only its hash as the `code_challenge`. In step 4 it sends the raw verifier, and the server hashes it and compares. Someone who steals the code in transit can't redeem it without the verifier. This matters most for **public clients**, such as single-page apps and mobile apps, which can't keep a client secret because anyone can read the code they ship. Current guidance is to use PKCE for every client, including those that do have a secret.

## Tokens and scopes

An access token is short-lived, minutes to an hour, so a leaked one stops working soon. It may be an opaque random string or a [JWT](/security/jwt), a token the resource server can check without calling anyone.

A short life would be miserable if you had to re-consent every hour. So the server also issues a **refresh token**, which is long-lived and exchanged at `/token` for a fresh access token with no consent screen. Keep it server-side or in secure device storage, and have the server issue a new one on each use (**rotation**) so a stolen one is detected when both copies are used.

**Scopes** are space-separated permission strings like `calendar.read`. Ask for the minimum. Meetly needs to read events, so it should not ask to edit them: the consent screen looks less alarming, and a leaked token can do less.

## From "what" to "who"

Now back to the thought we parked. Suppose Meetly also wants a "Log in with..." button. Can it use the access token to learn who you are? No. The token says what Meetly may do. It isn't defined to carry an identity, and what Meetly might read out of it is up to the provider.

**OpenID Connect** (OIDC) is a thin layer on OAuth 2.0 that adds authentication. Meetly adds the `openid` scope to the same flow in step 1. The token response gains an ID token, and the provider also exposes a `/userinfo` endpoint:

- an **ID token**, a JWT of identity claims: `sub` (a stable user ID), `iss` (who issued it), `aud` (which client it is for) and often `email` and `name`. Meetly validates its signature and checks that `iss` and `aud` match and that it hasn't expired (`exp`);
- a `/userinfo` endpoint where the access token can fetch more profile detail.

Most "Log in with..." buttons, such as Google's and Microsoft's, are this. Meetly should key its own accounts on `iss` plus `sub`, never on email, which can change.

## What goes wrong

- Trusting an access token as proof of identity, which is the mistake the ID token exists to prevent.
- Skipping the `state` check, which reopens the CSRF hole.
- Skipping PKCE, or shipping a client secret inside a single-page app, where anyone can read it.
- Long-lived access tokens, which make revocation slow.

**Rule of thumb.** Use OAuth when an app needs limited access to data it doesn't own, and add OIDC when it also needs to know who the user is. For a first-party app talking to its own backend, plain [session or token login](/security/jwt) is usually enough.
