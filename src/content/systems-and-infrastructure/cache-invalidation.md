---
title: Cache Invalidation
summary: A cache keeps serving its old copy until something tells it the data changed, and delete-on-write, write-through and TTLs each bound that staleness differently.
date: 2026-09-14
---

Say you run a shop, and the page for a mug shows its price, $20. Reading that price from the database on every page view is wasteful, so you keep a copy in a [cache](/systems-and-infrastructure/caching): a fast store that holds recently read values. Then you cut the price to $18. The database knows. The cache doesn't, and it will keep answering "$20", quickly and confidently, until something removes or replaces that copy.

**Cache invalidation** is the set of techniques for making that happen. It has a reputation for being hard, and the reason is that nothing in the system complains when it goes wrong. A stale answer looks exactly like a fresh one. So how do you decide when the copy is out of date? There are three common answers, and real systems usually combine them.

## Delete the entry when the data changes

The usual starting point is **cache-aside**: the application code manages the cache itself. A read checks the cache first, and on a miss (the key isn't there) it reads the database and stores the result. A write changes the database and then deletes the cached entry.

```python
def get_price(mug_id):
    price = cache.get(f"price:{mug_id}")
    if price is None:
        price = db.query("SELECT price FROM mugs WHERE id = ?", mug_id)
        cache.set(f"price:{mug_id}", price, ttl=300)
    return price

def set_price(mug_id, new_price):
    db.update("mugs", mug_id, price=new_price)
    cache.delete(f"price:{mug_id}")  # delete, don't cache.set(new_price)
```

Why delete instead of writing $18 straight into the cache? Because two price changes can arrive close together, and their cache writes can land in the opposite order from their database writes. If $18 reaches the database first and $15 second, but the cache sees $15 first and $18 second, the cache now holds $18 while the database holds $15, and it stays that way. A delete carries no value, so it can't leave a wrong one behind. The next read fetches whatever the database holds at that moment.

Delete-on-write is not airtight, though. Suppose a reader misses and reads $20 from the database. Before it stores that value, your write sets $18 and deletes the key. The slow reader then stores $20. The window is narrow, since the reader has to be slower than a write and a delete, but it is real, and the stale $20 now sits in the cache with a 300-second TTL, so it can be served for up to 5 minutes.

## Update the cache on every write

**Write-through** sends every write to the database and the cache together, in the same request. The cache then holds the new value immediately, and the first read after the price change is already a hit. You pay for it on the write path, which now touches two systems, and two concurrent writes can still reach them in different orders unless writes to one key are made to take turns. It also fills the cache with every value written, including ones nobody reads again, yet only on writes: a mug whose price hasn't changed since the cache started, or whose entry was evicted, still needs the miss path from cache-aside. And a value changed by any path that skips the write-through code, such as a manual fix to the database, is never refreshed.

## Let the entry expire

The third answer is the **TTL** (time to live), a timer after which the cache drops the entry on its own. You saw it in the code above: `ttl=300`. A TTL doesn't depend on anyone remembering to invalidate, so it catches the cases the other two miss: the racing reader above, the manual database fix, the code path someone forgot. It puts a ceiling on how wrong an entry can be. A 300-second TTL means a mug can show the old price for at most 5 minutes after the last time that entry was stored.

The cost of a short TTL is more misses, and each miss is a database read. With 1,000 reads a second on one mug, a 300-second TTL means about one database read per 300 seconds for that entry instead of 300,000. A 5-second TTL means one per 5 seconds, which is still a large saving and much fresher. When a heavily read entry expires, many requests can miss at once and all hit the database; that failure is called a [cache stampede](/systems-and-infrastructure/thundering-herd-problem).

## Choosing between them

No strategy removes staleness. Each one decides how long a wrong answer can live. So the design question is how long this particular piece of data can be wrong. A mug's price on a browsing page can lag by a few seconds without harm. The same price at the moment of payment cannot, and that is a different read from a different place, not a tighter cache.

In practice you combine them: delete on write to make the common case fresh, and a TTL on every entry to bound the cases the delete missed.

**Rule of thumb.** Delete the cached entry when you write, give every entry a TTL as a backstop, and set that TTL to the longest staleness the data can tolerate.

## Where you'll meet this

At checkout, a cached price is fine for the page that shows it, but the charge reads the source of truth, so the charge is right even if the page lagged. In a news feed, cached timelines and counters can run seconds behind without anyone noticing, so a short TTL alone is often enough and no invalidation code is needed. A URL shortener caches redirects for a long time because destinations rarely change, which makes the rare disabled link the case that needs an explicit delete, since waiting for the TTL would keep serving it.
