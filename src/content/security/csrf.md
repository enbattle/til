---
title: CSRF and CORS
summary: A malicious page can make your browser send an authenticated request to a site you're logged into (CSRF), and CORS, the rule about which other sites may read a site's responses, is easily mistaken for the defense against it.
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

A cookie is a small value a site asks your browser to store, and the browser attaches it to _every_ request to that site, even one triggered by a different site. So the forged transfer arrives with your session cookie, exactly like one you typed yourself.

Security people call this **ambient authority**: the credential travels with the request whether or not you meant it to. So the bank must ask not "is this person logged in?" but "did this request come from my own page?"

## Fix 1: the cookie declines to travel

When the server issues the cookie, the `SameSite` attribute says when the browser may attach it to a request that came from another site:

```
Set-Cookie: session=abc123; SameSite=Lax; Secure; HttpOnly
```

With `Lax`, the browser withholds the cookie on cross-site POSTs and on cross-site loads of images, iframes and `fetch` calls, but still sends it when you click a link to the site (a top-level GET navigation). `Strict` withholds it even then. Either way, the form on `evil.com` reaches the bank with no session.

Chrome and Edge treat a missing `SameSite` as `Lax`, but not every browser does, so set it explicitly. Note that "site" means the registrable domain (`bank.com`), so a hostile sibling subdomain is still same-site.

## Fix 2: a value only the bank's own page knows

What if the defense shouldn't depend on cookie handling? Have the server generate a **CSRF token**: an unguessable value tied to your session, embedded in the forms it serves and required on every request that changes state. The forged form doesn't contain it. The server either stores the token and compares, or sends it as a cookie too and requires a form field or header to match (no server storage, but it fails if an attacker can plant cookies on the bank's domain). As a second check, the server can reject state-changing requests whose `Origin` or `Referer` header names another site. [OAuth and OIDC](/security/oauth-oidc) uses the token idea on its redirect.

Why can't `evil.com` fetch the bank's page and copy the token? That's the next idea.

## The same-origin policy

An **origin** is a scheme, host and port: `https://bank.com` and `https://app.bank.com` are different origins. The **same-origin policy** is the browser rule that a page's JavaScript can send requests to other origins, but by default can't read what comes back. That is why `evil.com` can forge the transfer but can't read the token off the bank's page.

That blocks legitimate use too. Suppose the bank's own frontend at `https://app.bank.com` calls its API at `https://api.bank.com`. Different origins, so the browser would hide every API response from the frontend.

## CORS: the server opts in to being read

**Cross-origin resource sharing** (CORS) is how the API lifts that restriction for chosen origins. It answers with a header:

```
Access-Control-Allow-Origin: https://app.bank.com
```

The browser compares that to the page's origin and only then lets the script read the response. For a **simple request** (a GET, HEAD or form-style POST with no custom headers), the browser just sends it and checks the header on the way back.

For anything else, such as a `PUT`, an `Authorization` header or a JSON body, the browser first sends a **preflight**: an `OPTIONS` request asking whether the server accepts this method and these headers from this origin. The server answers with `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`, and only then does the real request go out.

What about a request that carries the bank's cookie, and reading its response? The frontend must ask (`fetch(url, { credentials: "include" })`), and the server must reply with `Access-Control-Allow-Credentials: true` and a specific origin. A wildcard (`Access-Control-Allow-Origin: *`) is refused when credentials are involved, so it suits only public data.

## CORS is not a CSRF defense

If `evil.com` isn't on the bank's CORS list, doesn't that stop the forgery? No. CORS controls who may **read** a response, not who may **send** a request. The self-submitting form is a simple request: it is sent, with the cookie, whatever CORS says, and the transfer happens. The browser only withholds the response from `evil.com`, which the attacker never needed.

A JSON `fetch` from `evil.com` would fail its preflight, but a form can send a `text/plain` body with no preflight, so you can't count on that. Worse, a server that echoes back any `Origin` as the allowed one, with credentials on, lets `evil.com` read the bank's responses too.

## Fix 3: don't use an ambient credential

Suppose the bank's frontend sent the session token in an `Authorization` header from its own JavaScript instead of a cookie. The browser never adds that header by itself, so the forged form arrives with no credential. Header-based auth is immune to CSRF for the same reason cookies are vulnerable: it isn't ambient. The trade-offs are in [JWT](/security/jwt).

## Where the hole opens

It needs two conditions: the endpoint authenticates with a cookie, and it changes state. That's why a GET should never change state: `GET /transfer?to=attacker&amount=5000` fires from a bare `<img>` tag, and even under `Lax`, `evil.com` can navigate your tab to that URL with the cookie attached. Only `Strict` or a token closes it.

**Rule of thumb.** If a browser attaches a credential on its own, the server must check that the request came from its own page: set `SameSite` explicitly, require a CSRF token on every state-changing request, never let a GET change state, and treat CORS as a rule about who may read responses, never as a check on who may send requests.
