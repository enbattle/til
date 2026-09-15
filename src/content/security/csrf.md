---
title: Cross-Site Request Forgery (CSRF)
summary: Why the browser attaching cookies to every request lets a malicious page act as a logged-in user, and how SameSite cookies and CSRF tokens stop it.
date: 2026-09-14
---

The browser automatically attaches a site's cookies to _every_ request to
that site — including requests triggered by a different site. Cross-site
request forgery (CSRF) exploits exactly that: a page on `evil.com` can
quietly cause the victim's browser to send an authenticated request to
`bank.com`.

```html
<!-- on evil.com; submits itself as soon as the page loads -->
<form action="https://bank.com/transfer" method="POST">
  <input type="hidden" name="to" value="attacker" />
  <input type="hidden" name="amount" value="5000" />
</form>
<script>
  document.forms[0].submit();
</script>
```

The victim is logged into `bank.com`, so the browser sends the request
exactly as if the victim had submitted it themselves — session cookie
included — and the bank has no way to tell the difference. The victim
never sees it happen.

## Ambient authority: the credential shows up whether you meant it to or not

The forged request is state-changing and perfectly authenticated — the
server has no built-in way to tell it apart from one the user intended.
Anything a logged-in user can do with a simple request (transfer money,
change their email, delete an account) an attacker can trigger from an
unrelated page. This is what separates CSRF from most other vulnerability
classes: nothing is stolen or guessed, the browser just does what it
always does — attach the cookie — at a moment the site never expected.

## Making intent provable again

- **`SameSite` cookies** — set the cookie's `SameSite` attribute when the
  server issues it:

  ```
  Set-Cookie: session=abc123; SameSite=Lax; Secure; HttpOnly
  ```

  `Lax` (the modern browser default) or `Strict` tells the browser not to
  send the cookie on cross-site requests, so `evil.com`'s form submission
  arrives at `bank.com` with no cookie attached at all — no session, no
  authenticated request. This alone neutralizes most CSRF; don't rely on
  the default being set for you, set it explicitly.

- **CSRF tokens** — a per-session, unguessable value the server generates,
  embeds in your forms, and requires on every state-changing request. The
  **same-origin policy** is the browser rule that lets a page read
  response data (like that embedded token) only from sites sharing its
  own origin — so `evil.com` can load `bank.com`'s transfer page in a
  hidden iframe, but the browser blocks its JavaScript from reading the
  token out of that page, which is exactly what stops it from forging a
  valid request. Two common ways to check the token:
  - _Synchronizer token_ — the server stores the token server-side (e.g.
    in the session) and compares it against the one submitted with the
    form.
  - _Double-submit cookie_ — the server also sends the token as a cookie;
    since JavaScript on `evil.com` can't read `bank.com`'s cookies either,
    a match between the cookie and the submitted form field proves the
    request originated from a page that could read both.
- **Check `Origin` / `Referer`** on unsafe methods as a secondary signal.
- **Non-automatic credentials** — auth sent in an `Authorization` header
  instead of a cookie isn't attached by the browser automatically, so it's
  immune to CSRF entirely (see [Session vs. Token Authentication](/security/session-vs-token-auth))
  — it sidesteps the ambient-authority problem by not being ambient in the
  first place.

## Where the hole opens up

Any endpoint that (a) authenticates via cookies and (b) changes state.
Safe methods should stay safe: a `GET` that mutates data is a CSRF hole,
because it can be triggered with a bare `<img>` tag — no form or script
needed at all.
