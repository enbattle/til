---
title: Encoding, Hashing and Encryption
summary: Encoding reformats data for transport and anyone can undo it, hashing is a one-way fingerprint, and encryption hides data from anyone without the key.
date: 2026-10-07
---

Your sign-up service receives three things in one request: a password, a saved card number, and a profile photo inside a JSON body. People reach for "encrypt it" for every one, but they need three different tools. Which goes where?

This page takes the photo (encoding), the password (hashing), and the card number (encryption), including how a browser and your server share a secret without having met.

## Encoding: changing the shape

JSON is text, and a photo is raw bytes that may not be valid text. So you rewrite the photo using a public rule: take every 3 bytes and write them as 4 characters from a 64-character alphabet of letters, digits, `+` and `/`. Anyone can follow it backward, because there is no key. A rewrite like this is an **encoding**, and this one is **Base64**.

```text
3 bytes = 24 bits, cut into four 6-bit pieces
each 6-bit piece (0 to 63) picks one character from the alphabet
size: 3 bytes become 4 characters, so 4 ÷ 3 ≈ 1.33, about a third bigger
```

The price is that growth; a separate binary upload is smaller and wins for large files. Other alphabets work the same way: a URL shortener writes a counter in **base62**, using `0-9`, `a-z` and `A-Z`, so the code is short and URL-safe. For how text becomes bytes, see [data representation](/computing-fundamentals/data-representation).

Base64 looks scrambled, so people mistake it for protection. A Base64 password is one anyone can read in one step. Encoding is never security.

The password needs something that hides it.

## Hashing: a one-way fingerprint

You never need to read a password back, only to check that a login attempt matches it. That points to a function that goes one way only. A **hash function** turns any input into a fixed-size output, called a **hash** or digest. SHA-256 always gives 256 bits, whether the input is one letter or a movie. The same input always gives the same output, and you can't run it backward except by guessing inputs.

So store each password's hash, and at login compare it with the attempt's hash. A leaked database gives the attacker hashes, not passwords.

The fingerprint has other jobs. Hash a file before and after a download, and a changed byte gives a different hash, which checks **integrity**. MD5 and SHA-1 have practical collision attacks, so use SHA-256 or better. A hash map (a key-value table) hashes each key to pick its storage slot.

Is plain SHA-256 enough? No: it's fast and most passwords are guessable, so a graphics card tries billions of guesses a second. A password hash such as **bcrypt** or **Argon2** is deliberately slow, which makes each guess expensive.

There is a second leak. Two users with the password "hunter2" get identical hashes, so cracking one cracks both, and an attacker can precompute common passwords' hashes once and look every leaked hash up. The fix is a **salt**: a random value per user, stored beside the hash and mixed into the password before hashing, so the same password hashes differently for each user.

Hashing can't help with the card number, because you must read it back to charge it.

## Encryption: reversible with a key

To hide something and still recover it, scramble it with a secret value, a **key**, so only a holder of the key can unscramble it. This is **encryption**.

The simplest kind is **symmetric**: one key both locks and unlocks, as the standard cipher AES does. It is fast, so it handles bulk data.

Now the browser holds a card number to send you, and your server needs the key to read it. Suppose the server just sends the key first. Anyone watching the connection copies it, and then reads the card number too. How do two strangers get a shared secret?

Change the lock instead. Imagine your server makes a padlock in two halves: the closing half snaps a box shut, and only the opening half opens it. The server keeps the opening half and hands the closing half to everyone. The browser snaps the card number shut and sends the box. An eavesdropper has the closing half too, yet it can't open anything.

The closing half is the **public key**: anyone may have it, and it only locks. The opening half is the **private key**, which the server never shares.

Together they are a **key pair**, and using one is **asymmetric** encryption. The public key doesn't reveal the private one.

The browser needed nothing secret in advance. The cost is speed: asymmetric encryption is much slower than AES. Early [TLS](/computing-fundamentals/http-and-https) used it for one short step, locking a small fresh symmetric key that both sides then used. Real TLS today has both sides agree on a fresh key without sending it, and the server's key pair proves its identity by signing.

So asymmetric keys let strangers start safely, and symmetric encryption does the bulk work.

TLS decrypts the card on arrival. To store it, encrypt it again with a separate key kept somewhere other than the database, such as a key management service. Many teams let a payment provider hold card numbers and hand back a token.

## Signing: proof, not secrecy

After sign-up, your server hands the browser a session token. A **signature** gives it proof of origin: only the private key can make one, and anyone with the public key can check it. It shows who produced the data and that it hasn't changed, and hides nothing. A signed [JWT](/security/jwt) token is readable by whoever holds it, yet nobody can alter it without the check failing.

When both sides already share a secret, an **HMAC** mixes that key into a hash, so only holders of the key can produce a valid one.

**Rule of thumb.** Ask what you need to do with the data afterward. If it only needs to fit a format, encode it. If you only ever need to check a match, hash it, and slowly and with a salt when it's a password. If you must read it back, encrypt it, using a public key to start a conversation with a stranger, and protect the key more than the data.
