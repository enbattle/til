---
title: Cross-Site Request Forgery (CSRF)
summary: A malicious page can make your browser send an authenticated request to a site you're logged into, and SameSite cookies and CSRF tokens are how that site refuses it.
date: 2026-09-14
---

You're logged into `bank.com`. In another tab, you open a page on `evil.com`. The page contains this:

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

You never click anything. Does the transfer go through? If `bank.com` relies only on your session cookie, yes. This attack is **cross-site request forgery** (CSRF): a page on one site causes your browser to send a request to another site, using your logged-in session.

## Why the bank can't tell the difference

A cookie is a small value a site asks your browser to store, and the browser attaches it to _every_ request to that site. It does so even when the request was triggered by a different site. That is the whole mechanism. Your browser sends the forged transfer with your session cookie, exactly as it would send a transfer you typed in yourself, and the bank sees a valid session asking for a valid action.

Security people call this **ambient authority**: the credential travels with the request whether or not you meant it to. Nothing is stolen or guessed here. The browser does what it always does, at a moment the bank never expected. So the bank needs some way to ask a different question: not "is this person logged in?" but "did this request come from my own page?"

## Fix 1: the cookie declines to travel

The first defence is in the cookie itself. When the server issues it, the `SameSite` attribute says when the browser may attach it to a request that came from another site:

```
Set-Cookie: session=abc123; SameSite=Lax; Secure; HttpOnly
```

With `Lax`, the browser withholds the cookie on cross-site POSTs and on cross-site loads of images, iframes and `fetch` calls. It still sends the cookie when you click an ordinary link to the site, which is a top-level GET navigation. With `Strict`, it withholds the cookie even then. Either way, the form on `evil.com` reaches the bank with no session, and the bank rejects it.

Should you count on the browser's default? No. Chromium-based browsers such as Chrome and Edge treat a cookie with no `SameSite` attribute as `Lax`, but not every browser does, so set it explicitly. Note also that "site" means the registrable domain, such as `bank.com`, so a hostile page on a sibling subdomain is still same-site and `SameSite` does not stop it.

## Fix 2: a value only the bank's own page knows

What if you want a defence that doesn't depend on the browser's cookie handling? Have the server generate a **CSRF token**: an unguessable value tied to your session, embedded in every form the bank serves and required on every request that changes state. The forged form from `evil.com` doesn't contain it, so the bank rejects the request.

Why can't `evil.com` just fetch the bank's page and copy the token? Because of the **same-origin policy**, the browser rule that lets a page read responses only from its own origin (scheme, host and port). `evil.com` can make your browser send requests to `bank.com`, but its JavaScript can't read what comes back.

There are two common ways to check the token:

- **Synchronizer token.** The server stores the token (for example in your session) and compares it with the one submitted in the form.
- **Double-submit cookie.** The server sends the token as a cookie too, and requires the cookie and a form field or header to match. `evil.com` can't read the bank's cookies, so it can't produce a matching pair. This works without server-side storage, but it depends on the attacker being unable to plant a cookie on the bank's domain, which a hostile subdomain may manage.

As a secondary signal, the server can also check the `Origin` or `Referer` header on state-changing requests and reject any that name another site.

## Fix 3: don't use an ambient credential

Suppose the bank sent your session token in an `Authorization` header from its own JavaScript instead of in a cookie. The browser never adds that header on its own, so the form on `evil.com` arrives with no credential at all. Header-based auth is immune to CSRF for the same reason cookies are vulnerable: it isn't ambient. The trade-offs of that approach are in [JWT](/security/jwt).

## Where the hole opens

Back to `bank.com`. The hole needs two conditions: the endpoint authenticates with a cookie, and it changes state. This is also why safe methods, meaning methods meant only to read, like GET, should stay safe. A `GET /transfer?to=attacker&amount=5000` could be triggered by a bare `<img src="...">` tag on `evil.com`, with no form or script. `SameSite=Lax` withholds the cookie from that image load, but not from a top-level navigation: if `evil.com` sets `window.location` to the same URL, the cookie goes along. A GET that changes state is therefore open under `Lax`, and only `Strict` or a CSRF token closes it.

**Rule of thumb.** If a browser attaches a credential on its own, the server must check that the request came from its own page: set `SameSite` explicitly, require a CSRF token on every state-changing request, and never let a GET change state.
