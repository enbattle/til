---
title: Same-Origin Policy and CORS
summary: Browsers let a page send requests to other sites but hide the responses unless the other site opts in with CORS headers, and that rule governs who may read a response, never who may send a request.
date: 2026-10-14
---

You're building a small dashboard. Its frontend is served from `https://app.shop.com` and loads orders from an API at `https://api.shop.com`. You write `fetch("https://api.shop.com/orders")`, the request goes out, the API answers with the orders, and the browser console says the request was blocked. The server worked. What blocked it?

This page covers what an origin is, what the browser's rule about origins blocks and what it lets through, the response headers that open it up, and the extra request the browser sends first for anything non-trivial.

## What counts as the same place

An **origin** is a scheme, host and port together. Each of these is a different origin from the dashboard's `https://app.shop.com`:

```
https://api.shop.com       (different host)
http://app.shop.com        (different scheme)
https://app.shop.com:8443  (different port)
```

So your dashboard and your API are different origins, even though one team runs both. The browser has a rule about that.

## What the browser blocks, and what it doesn't

The **same-origin policy** says a page's JavaScript can't read responses from another origin. It does not stop the page from sending the request. The browser still sends it, then hides the answer from the script. Whether the user's cookies go along depends on the kind of request, covered below.

That is why the dashboard's `fetch` reaches the API and still fails: the request went out, and the response was withheld. The policy also doesn't stop a page from embedding another origin's images, scripts or iframes, or from submitting a form to it. It stops reading.

The policy is what keeps a page on `evil.com` from reading your account data off `shop.com`. It is also in the way of your own dashboard. How does the API say "my own frontend may read this"?

## CORS: the server opts in to being read

**Cross-origin resource sharing** (CORS) is how a server lifts the restriction for chosen origins. It answers with a header:

```
Access-Control-Allow-Origin: https://app.shop.com
```

The browser compares that to the page's origin and only then lets the script read the response. The dashboard works once the API sends it.

The header names one origin, or `*` for any. A wildcard is fine for public data such as a published price list, but not for responses that depend on who is asking.

That covers reading with a plain GET. What about a request that changes something?

## Preflight: asking before sending

A **simple request** (a GET, HEAD or form-style POST with no custom headers) is just sent, and the browser checks the header on the way back. That matches what a plain HTML form could always do.

Anything else, such as a `PUT`, an `Authorization` header or a JSON body, is something a page could never send cross-origin before CORS existed. So the browser first sends a **preflight**: an `OPTIONS` request asking whether the server accepts this method and these headers from this origin.

```
OPTIONS /orders/17
Origin: https://app.shop.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: content-type
```

The server answers with `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`. Only if they cover the request does the real `PUT` go out. If the preflight is refused, the real request is never sent.

So far the dashboard has called the API without logging in. What changes when the API uses a session cookie?

## Requests that carry cookies

By default a cross-origin `fetch` sends no cookies. The frontend must ask (`fetch(url, { credentials: "include" })`), and the server must reply with `Access-Control-Allow-Credentials: true` and a specific origin. A wildcard `Access-Control-Allow-Origin: *` is refused when credentials are involved.

A tempting shortcut is to copy whatever `Origin` the request carried into the allow header. With credentials on, that lets any site, `evil.com` included, read a logged-in user's responses, which is the wildcard's refusal undone.

## What CORS does not do

CORS controls who may **read** a response, not who may **send** a request. A simple request is sent whatever the server's CORS answer says, and the browser only withholds the response. If it is a form submission, or a `fetch` with `credentials: "include"`, it carries the user's cookie whenever the cookie's SameSite setting allows. A JSON `fetch` from another site would fail its preflight, but a form can send a `text/plain` body with no preflight, so a missing CORS header doesn't protect a state-changing endpoint. That gap is the subject of [CSRF](/security/csrf).

**Rule of thumb.** The same-origin policy hides responses, not requests, and CORS headers are the server's list of origins allowed to read them: name specific origins for anything user-specific, use `*` only for public data, and never treat CORS as the thing that decides who may send a request.
