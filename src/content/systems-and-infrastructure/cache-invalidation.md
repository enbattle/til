---
title: Cache Invalidation
summary: Storing a value in a cache is easy — the strategies for keeping it from silently going stale once the real data changes are the actual hard part.
date: 2026-09-14
---

A **cache** is a copy of data kept somewhere faster to read from than
its original source, so a system doesn't have to redo expensive work
(hit a slow database, recompute a result) every single time the same
data is needed again. **Cache invalidation** is the set of techniques for
making sure that copy gets updated or thrown away once the real,
underlying data changes — without it, a cache just serves an
increasingly wrong answer, quickly and confidently.

There's a well-known line about why this is harder than it sounds: "there
are only two hard things in computer science: cache invalidation and
naming things." Storing a value and returning it next time is the easy
part. Noticing, correctly and every time, that the value is no longer
current is the actual hard part — and getting it wrong means silently
serving stale data, which is a worse failure than having no cache at all,
because nothing about the response signals that anything is wrong.

## Cache-aside: read through the cache, delete (don't update) on write

In the **cache-aside** pattern, application code reads through the cache
directly: check the cache first, and only fall back to the real source on
a miss, storing the result in the cache before returning it.

```python
def get_user(user_id):
    cached = cache.get(f"user:{user_id}")
    if cached is not None:
        return cached
    user = db.query("SELECT * FROM users WHERE id = ?", user_id)
    cache.set(f"user:{user_id}", user, ttl=300)
    return user

def update_user(user_id, changes):
    db.update("users", user_id, changes)
    cache.delete(f"user:{user_id}")  # not cache.set(...) — see below
```

The write side is the part worth paying attention to: after writing to
the real data source, the code **deletes** the cache entry rather than
writing the new value into the cache directly. That's deliberate — if two
writes to the same key happen close together and finish out of order, a
direct cache update from each write risks the _older_ write's result
landing in the cache last, where it would then sit as the served value
indefinitely. Deleting the entry instead just means the next read
recomputes it fresh, which is slower for that one read but can't leave a
stale value parked in the cache.

## Write-through: keep the cache current the instant a write happens

**Write-through** takes a different approach: every write goes to the
cache and the real data source together, as a single path, so the cache
is never more than an instant out of date. The cost is added latency on
every write, since it now has to update two places instead of one — and
a cold cache still needs some fallback for keys that have never been
written since the cache started up, since write-through only updates the
cache for writes that actually happen through it.

## A TTL as a safety net, even with either strategy above

Even with cache-aside or write-through in place, giving every cached
value a short **TTL** (time-to-live, after which it expires automatically)
is worth keeping as a backstop. Neither strategy is immune to a bug — a
write path that bypasses the normal update-and-invalidate logic, for
instance — and a TTL puts a hard ceiling on how long any such missed
invalidation can stay silently wrong, even in the worst case.

## The actual design question

No single strategy eliminates staleness completely — every one of them
just bounds it differently. The real design question isn't "is this cache
correct," since a cache is rarely simply correct or broken; it's how much
staleness a specific piece of data can tolerate, and for how long, and
which strategy (or combination) keeps the actual staleness inside that
bound. This applies anywhere a cache sits in front of a slower source of
truth: an in-memory cache in front of a database, HTTP caching in a
browser, or a content-delivery layer sitting in front of an origin
server.
