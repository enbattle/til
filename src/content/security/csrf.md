---
title: Cross-Site Request Forgery (CSRF)
summary: A malicious page can make your browser send an authenticated request to a site you're logged into, and the defenses are a cookie that declines to travel, a token only the real page knows, or a credential the browser never attaches by itself.
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

This page covers why the bank can't tell the forged request from yours, three ways to defend the transfer endpoint, and where the hole stays open anyway.

## Why the bank can't tell the difference

A cookie is a small value a site asks your browser to store, and the browser attaches it to _every_ request to that site, even one triggered by a different site. So the forged transfer arrives with your session cookie, exactly like one you typed yourself.

Security people call this **ambient authority**: the credential travels with the request whether or not you meant it to. So the bank must ask not "is this person logged in?" but "did this request come from my own page?"

The first way to ask is to stop the cookie from travelling.

## Fix 1: the cookie declines to travel

When the server issues the cookie, the `SameSite` attribute says when the browser may attach it to a request that came from another site:

```
Set-Cookie: session=abc123; SameSite=Lax; Secure; HttpOnly
```

With `Lax`, the browser withholds the cookie on cross-site POSTs and on cross-site loads of images, iframes and `fetch` calls, but still sends it when you click a link to the site (a top-level GET navigation). `Strict` withholds it even then. Either way, the form on `evil.com` reaches the bank with no session.

Chrome and Edge treat a missing `SameSite` as `Lax`, but not every browser does, so set it explicitly. Note that "site" means the registrable domain (`bank.com`), so a hostile sibling subdomain is still same-site.

That leaves the defense in the browser's hands. What if the bank wants a check of its own?

## Fix 2: a value only the bank's own page knows

Have the server generate a **CSRF token**: an unguessable value, embedded in the forms the bank serves and required on every request that changes state. The forged form on `evil.com` doesn't contain it, so the bank rejects the transfer.

Why can't `evil.com` fetch the bank's page and copy the token? A page's JavaScript may send a request to another site, but by default the browser won't let it read what comes back. That rule is the same-origin policy, and [Same-Origin Policy and CORS](/security/same-origin-policy-and-cors) covers it in full. For CSRF, it is why the attacker can forge the request but not see the token.

There are two ways to check the token.

**Synchronizer token.** The server stores a random token for your session, puts it in each form, and compares the submitted one to the stored one. Its only cost is server-side state.

**Double-submit cookie.** The server sets the random token as a cookie too, and requires the same value in a form field or header. A forged request carries the cookie but can't supply a matching field, because `evil.com` can't read the cookie's value. Nothing is stored on the server. Its weakness is that the server only checks that the two values match, not that it issued them. An attacker who can plant a cookie on the bank's domain, say from a hostile sibling subdomain, picks their own value, sets it as the cookie, and puts the same value in the forged form. Both match, and the check passes.

So the synchronizer token trades server memory for strength, and the double-submit cookie trades strength for statelessness. Neither survives [cross-site scripting](/security/xss): script running on the bank's own page can read the token and send it, and an XSS hole defeats every CSRF defense on this page.

As a second check, either variant can pair with rejecting state-changing requests whose `Origin` or `Referer` header names another site. [OAuth and OIDC](/security/oauth-oidc) uses the token idea on its redirect.

Tokens work, but every form needs one. Could the credential stop being ambient instead?

## Fix 3: don't use an ambient credential

Suppose the bank's frontend sent the session token in an `Authorization` header from its own JavaScript instead of a cookie. The browser never adds that header by itself, so the forged form arrives with no credential. Header-based auth is immune to CSRF for the same reason cookies are vulnerable: it isn't ambient. The trade-offs are in [JWT](/security/jwt).

One kind of request still gets past `Lax`.

## Where the hole opens

It needs two conditions: the endpoint authenticates with a cookie, and it changes state. That's why a GET should never change state: `GET /transfer?to=attacker&amount=5000` fires from a bare `<img>` tag, and even under `Lax`, `evil.com` can navigate your tab to that URL with the cookie attached. Only `Strict` or a token closes it.

One more trap: it is tempting to think the bank's CORS settings stop `evil.com`. They don't. CORS governs who may read a response, and the self-submitting form never needed to read anything. [Same-Origin Policy and CORS](/security/same-origin-policy-and-cors) explains why.

**Rule of thumb.** If a browser attaches a credential on its own, the server must check that the request came from its own page: set `SameSite` explicitly, require a CSRF token on every state-changing request (stored per session, since a bare double-submit cookie falls to a planted cookie), never let a GET change state, and don't count on CORS to stop a request from being sent.
