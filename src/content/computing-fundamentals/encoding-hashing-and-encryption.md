---
title: Encoding, Hashing and Encryption
summary: Encoding reformats data for transport and anyone can undo it, hashing is a one-way fingerprint, and encryption hides data from anyone without the key.
date: 2026-10-07
---

Your sign-up service receives three things in one request: a password, a saved card number, and a profile photo inside a JSON body. All three need protecting or reshaping, and people reach for "encrypt it" for every one. They need three different tools. Working out which goes where is the whole topic.

## Encoding: changing the shape

An **encoding** is a public rule for rewriting data in another form so it survives a trip or fits a format. There is no key and no secret, so anyone can reverse it.

The photo is the case for it. JSON is text, and a photo is raw bytes that may not be valid text. **Base64** rewrites every 3 bytes as 4 plain characters from a 64-character alphabet, so the photo can sit inside the JSON string. The price is size: the data grows by about a third. The alternative is sending the photo as its own binary upload, which is smaller, and it wins for anything large. For how text itself becomes bytes, see [data representation](/computing-fundamentals/data-representation).

Why mention it here? Because Base64 looks scrambled, and people mistake it for protection. A Base64 password is a password anyone can read in one step. Encoding is never security.

## Hashing: a one-way fingerprint

A **hash function** turns any input into a fixed-size output called a hash or digest. SHA-256 always gives 256 bits (64 hex characters), whether the input is one letter or a movie. Two properties matter. The same input always gives the same output. And you can't run it backward to recover the input, short of guessing inputs and comparing.

That fits two jobs. One is **integrity**: hash a file before and after a download, and a changed byte gives a completely different hash. The other is **lookup**, which is how a [hash map](/dsa/hash-map) finds a key's bucket. There the hash only needs to spread keys evenly, not resist attackers.

Now the password. You never need to read it back, only to check that a login attempt matches. So store a hash and compare hashes. If your database leaks, the attacker gets hashes, not passwords.

Is SHA-256 enough? No, because it's fast. A graphics card can try billions of guesses a second, and most people's passwords are guessable. A password hash such as **bcrypt**, **scrypt** or **Argon2** is deliberately slow and, for the last two, memory-hungry, which makes each guess expensive. You also add a **salt**: a random value generated per user, stored beside the hash and mixed into the password before hashing. Without salts, two users with the password "hunter2" have identical hashes, so cracking one cracks both. Attackers could also precompute a table of common passwords' hashes once and look up every leaked hash in it. A per-user salt defeats both, because the same password now hashes differently for each user. The salt doesn't slow a guess against one account. The slow hash does that.

Avoid **MD5** and **SHA-1** for anything security-related. Researchers can construct two different inputs with the same hash, a **collision**, which breaks the "fingerprint" promise.

## Encryption: reversible with a key

The card number is different, because you must read it back later to charge it. A hash won't work, so you **encrypt** it: scramble it so only someone with the **key**, a secret value, can reverse it.

**Symmetric** encryption, such as AES, uses one shared key to lock and unlock. It's fast, so it handles bulk data. The catch is that both sides need the same key, and you can't send it over the open internet without exposing it.

**Asymmetric** encryption uses a key pair: a public key anyone may have, and a private key you keep. What one key does, only the other can undo or check. That lets two strangers set up a secret, but it's much slower. So real systems combine them: use the asymmetric step to agree on a fresh symmetric key, then encrypt the traffic with that. [TLS](/computing-fundamentals/http-and-https) does this.

Where the data sits also matters. Encryption **in transit** protects the request on its way to you, and HTTPS provides it. Encryption **at rest** protects the stored card number if someone copies the database, and it only helps if the key lives somewhere else, such as a key management service. A key stored in the same database undoes it. Many teams avoid holding card numbers at all, and let a payment provider keep them and hand back a token.

## Signing: proof, not secrecy

One more neighbor. A **signature** proves who produced data and that it hasn't changed, using a key. It doesn't hide anything. A signed [JWT](/security/jwt) is readable by whoever holds it, yet nobody can alter it without the check failing. Signing and encrypting answer different questions, and you can do both.

**Rule of thumb.** Ask what you need to do with the data afterward. If it only needs to fit a format, encode it. If you only ever need to check a match, hash it, and slowly and with a salt when it's a password. If you must read it back, encrypt it, and protect the key more than the data.
