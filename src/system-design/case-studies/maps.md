---
title: Design a Maps and Navigation Service (like Google Maps)
summary: Serving the world's map as cached vector tiles, finding places, and routing drivers on live traffic built from their own phones' GPS points.
date: 2026-09-29
order: 12
---

A maps service does three jobs that share one picture of the world. It draws
the map, so a phone can pan across a city smoothly. It finds places: typing
"blue bottle coffee" or "221B Baker Street" returns a point on the map, a
lookup called **geocoding** (the reverse, turning a point into an address, is
**reverse geocoding**). And it gives directions: the fastest route from here to
there, with an **ETA** (estimated time of arrival) that accounts for the
traffic on the roads right now.

Drawing the map is a huge, cacheable download; routing is a graph search over
road travel times that change every minute and come from the phones being
routed. What follows is one plausible design for a service like Google Maps
or an OpenStreetMap-based app, not a description of how any of them is built.

## Requirements

Functional requirements:

- **Show the map.** Pan and zoom anywhere in the world, from a whole continent
  down to individual buildings, with a day and a night style.
- **Search places.** Find businesses, landmarks and addresses by name, ranked
  by relevance and nearness, with suggestions as the user types.
- **Reverse geocode.** Turn a tapped point into the nearest address.
- **Route.** Driving directions between two points, with up to three
  alternatives and an ETA for each.
- **Navigate.** Turn-by-turn guidance during a drive, with the ETA kept up to
  date and a faster route offered when traffic changes.
- **Live traffic.** Road speeds that reflect current conditions, built from
  the GPS positions of phones that are navigating.

Out of scope: a traffic layer colouring roads by speed; walking, cycling and
transit routing; offline maps, satellite imagery, reviews and photos; and the
tools for editing the map. The map data (roads, speed limits, turn
restrictions, places) arrives from an existing editing system as a daily
export.

Non-functional requirements:

- **Scale:** 100 million daily active users. 20 million navigation sessions a
  day, averaging 25 minutes each.
- **Latency:** a map tile in under 100 ms at p99 from the CDN (the 99th
  percentile, the time 99% of requests beat); a search suggestion in under
  150 ms at p99; a route in under 1 second at p99, measured at our servers.
- **Traffic freshness:** a slowdown seen by phones reaches routing within 3
  minutes.
- **Availability:** tiles 99.99%, search and routing 99.95%. If live traffic
  fails, routing keeps working on typical speeds for that time of week rather
  than failing.

## Back-of-the-envelope estimates

A day is 86,400 seconds. The users are spread across time zones, which flattens
the global daily curve; this design assumes a peak of **3× average** rather
than the 10× rule of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know),
which suits a service whose users all wake up at once. Servers are sized to
run at no more than about 50% CPU at that peak.

**Tile requests.** A map screen is assembled from square images or data files
called **tiles** (the first deep dive). Assume each user fetches 100 tiles a
day after the phone's own cache.

- 100,000,000 × 100 = 10 billion tile requests a day.
- Average: 10,000,000,000 ÷ 86,400 ≈ 116,000 a second.
- Peak: 116,000 × 3 ≈ **350,000 tile requests a second**.
- A **CDN** (content delivery network: caching servers near users) that
  answers 95% of them leaves 350,000 × 0.05 ≈ **17,500 a second** for the
  tile store.
- Requested tiles skew towards dense cities; assume 40 KB each. Peak CDN
  egress: 350,000 × 40 KB = 14 GB/s, about 112 Gbit/s.

**Navigation and probes.** A **probe** is one GPS reading from a navigating
phone: position, time, speed and heading, about 50 bytes.

- 20,000,000 sessions × 25 minutes = 500 million session-minutes a day.
- Concurrent sessions on average: 500,000,000 ÷ 1,440 minutes ≈ 347,000.
- Peak: 347,000 × 3 ≈ **1 million concurrent sessions**.
- One probe per second each, uploaded in batches every 10 seconds: **1
  million probes a second** in **100,000 uploads a second** at peak.
- Probe volume per day: 20,000,000 × 25 × 60 = 30 billion probes, × 50 bytes =
  **1.5 TB a day**.

**Route searches.** Assume one new route request per user per day, and a
reroute check every 60 seconds during navigation.

- New routes: 100,000,000 ÷ 86,400 ≈ 1,160 a second; peak ≈ 3,500.
- Reroute checks at peak: 1,000,000 ÷ 60 ≈ 16,700 a second.
- Total at peak: about **20,000 route searches a second**.
- Assume 10 ms of CPU per search, including three alternatives and turning
  the result into a drawable line: 20,000 × 0.01 = **200 cores busy**.

**The road graph.** Assume the world's drivable roads come to about 300
million intersections and 700 million one-way road segments (a two-way street
is two segments).

- At about 100 bytes per segment for its endpoints, length, road class, the
  routing overlay from the second deep dive and a compressed shape: 700,000,000
  × 100 bytes = **70 GB**.
- A segment index fits in 4 bytes (700 million is under the 4.29 billion a
  32-bit number holds), so a live speed per segment, 2 bytes each, is a 1.4
  GB array.

**Places.** Assume 250 million places at 1 KB each, 250 GB, and two searches
per user per day at five suggestion requests per search: 1 billion requests a
day, about 11,600 a second on average and **35,000 a second at peak**.

What the estimates say: tiles are the most traffic but cache well. Probes are
only 50 MB/s at peak (1,000,000 × 50 bytes), as long as the route isn't
resent with them (API design). The hard part is 20,000 route
searches a second over a 70 GB graph whose weights change every minute.

## Data model

An offline build turns the daily export into read-only products shaped for
each job (the road graph, the tiles and the place data), so no online service
queries the raw map.

**The road graph**, loaded into each routing server's memory:

```text
segment (one per direction of travel)
  index         uint32     0 .. 699,999,999, position in every array below
  from_node     uint32     intersection it leaves
  to_node       uint32     intersection it enters
  length_m      uint16
  road_class    uint8      motorway, primary, residential, ...
  flags         uint8      toll, ferry, unpaved
  profile_id    uint16     one of ~4,000 typical weekly speed curves
  profile_scale uint8      scales that curve to this road
  shape         bytes      compressed polyline, for drawing the route
turn_restriction
  from_segment, via_node, to_segment     "no left turn here"
graph_version   "2026-09-29"   every route and delta names the graph it used
```

**Historical speeds.** A motorway into a city is slow at 8:30 on a weekday
and fast at 3:00. Storing a separate curve of 672 values (one per 15 minutes of the week) for every
segment would take 700 million × 672 bytes ≈ 470 GB. Most roads follow one of
a few thousand shapes, though, so each segment stores a 2-byte reference to a
shared curve plus a 1-byte scale, about 2.1 GB in total. The curves are
recomputed weekly from archived probes.

**Live speeds** are the 1.4 GB array from the estimates: one 2-byte speed per
segment, 0 meaning "no live value", overwritten by the traffic pipeline.

**Places**, in the place database (the source of truth for place edits) and
copied into the search index:

```text
place
  place_id     string     "p_8f3k2"
  name         string     "Blue Bottle Coffee"
  category     string
  lat, lng     double
  cell_id      uint64     S2 cell at level 13, about 1 km across
  address      structured street, number, city, postcode
  popularity   float
  version      uint64     bumped on every edit
```

`cell_id` is a **spatial cell**: the globe cut into a hierarchy of cells, so
that "near this point" becomes "in this cell or its neighbours", a lookup an
ordinary [database index](/systems-and-infrastructure/database-indexing) can
answer. S2 (square cells on a cube projected onto the sphere) and geohash
(rectangles named by a base-32 string) are two common schemes.

**Tiles** are files in object storage, keyed by
`{block_version}/{z}/{x}/{y}`, explained in the first deep dive.

## API design

**Tiles** are static files, fetched straight from the CDN:

```http
GET /tiles/b41/14/2620/6332.mvt
```

`14/2620/6332` is zoom 14, column 2,620, row 6,332, a square of San
Francisco; `b41` is a version (first deep dive). The response is cacheable
for a year.

**Search and geocoding**:

```http
GET /search?q=blue+bottle&near=37.776,-122.423&limit=5
GET /reverse?lat=37.776&lng=-122.423
```

Both return places with `place_id`, name, address and coordinates.

**Route**:

```http
POST /routes
{ "origin": [37.776, -122.423], "destination": [37.335, -121.893],
  "depart_at": "now", "alternatives": 3 }
```

returns up to three routes, each with an encoded polyline, turn instructions,
distance, an ETA, and a `route_token`: an opaque string naming the graph
version and the list of segment indexes. A 60 km drive crosses a few thousand
segments at 4 bytes each, so a token is about 20 KB.

**Navigation update**, sent every 10 seconds while driving:

```http
POST /navigation/{session_id}/updates
{ "seq": 118, "points": [ ...10 probes... ] }

200 OK
{ "eta": "2026-09-29T09:14:00Z", "better_route": null }
```

`session_id` is a random ID made fresh for each trip, so probes aren't tied to
an account. `seq` counts up by one per batch, and a timed-out batch is retried
with the same `seq` so the pipeline can recognise the repeat, as
[idempotency](/systems-and-infrastructure/idempotency) describes.

Resending the `route_token` each time would be 100,000 × 20 KB = 2 GB/s, 40
times the probes. Instead only the first update carries it; the gateway
hashes `session_id` to pick one routing server for the whole trip, which keeps
the route in memory (1 million × 20 KB = 20 GB, about 1 GB a server). A server
without the route answers "resend route" and gets the token once. Every call
re-sums the ETA over the route's remaining segments (microseconds); every
sixth call runs a full route search and fills in `better_route` if one saves
more than a couple of minutes.

## High-level architecture

![Architecture of the maps service. The mobile or web client fetches tiles and the tile manifest from the CDN, which reads the tile store in object storage on a miss. Search, route and probe-upload requests go to the API gateway, which sends them to the search service and place index, the routing servers, and the probe queue. Traffic aggregators consume the probe queue and write deltas and a pointer to the speed snapshot store, which the routing servers poll to load deltas. An offline map build pipeline produces the tiles, the road graph for the routing servers, and the places for the search service.](/diagrams/maps/architecture.svg)

- The **CDN** and **tile store** serve the map (first deep dive). The tile
  store is object storage, which keeps files by name and serves them whole.
- The **API gateway** terminates TLS (decrypts the `https` connection),
  checks each caller's [rate limit](/system-design/rate-limiter), and forwards
  requests to the services behind it.
- The **search service** holds the place index: text search with a location
  filter, split into **shards** (each holding the places of one group of
  regions) and replicated. A query with a `near` point goes to the shard for
  that region. A small index of the ten million most prominent places is
  copied to every shard, so "Eiffel Tower" typed in New York still finds
  Paris.
- The **routing servers** each hold the whole road graph, the historical
  curves and the live speed array in memory (second deep dive).
- The **probe queue**, **traffic aggregators** and **speed snapshot store**
  turn probes into live speeds (third deep dive). The snapshot store is object
  storage for the speed files plus a small consensus store for the pointers
  and leases described there.
- The **map build pipeline** runs daily, offline, and produces the tiles, the
  next road graph version and the place data.

Place edits between builds, such as a café changing its opening hours, go to
the place database (inside the search service box). The edit and an outbox
row are written in one transaction, and a relay publishes outbox rows to the
indexer, as the [outbox pattern](/systems-and-infrastructure/outbox-pattern)
describes. A relay crash can publish a row twice; the indexer applies an
update only if its `version` is newer than the indexed one, so a repeat or a
late, older edit changes nothing.

During a drive, the gateway puts each probe batch on the probe queue and asks
the session's routing server for the updated ETA; within 3 minutes those
probes are part of the speeds everyone else is routed on.

## Deep dive: serving map tiles

The world is drawn as a pyramid of square tiles. At zoom level 0, one tile
covers the whole world; each level splits every tile into four, so zoom _z_
has 2^z × 2^z tiles. At zoom 14 that is 16,384 × 16,384, about 268 million
tiles, each about 2.4 km across at the equator (40,075 km ÷ 16,384). The
screen asks for the handful of tiles that cover it at the current zoom.

**Option 1: raster tiles.** Each tile is a finished 256 × 256 pixel image.
Showing pictures is simple and looks the same everywhere; the cost is
volume. Street-level detail needs zoom 18 (tiles about 150 m
across): 4^18 ≈ 68.7 billion tiles, and at about 30% land, 20 billion worth
storing. At 15 KB each that is 300 TB, and it multiplies: a night style
doubles it, and sharp screens need 2× and 3× images, so six variants make at
least 1.8 PB. Raster services therefore usually pre-render the low zooms and
render the rest on demand, caching what gets asked for. Labels are baked into
the pixels, so rotating the map during navigation turns them sideways.

**Option 2: vector tiles.** Each tile holds the geometry (road lines, building
outlines, label positions) for its square, and the phone draws it with the
GPU using a style file. Tiles are built only to zoom 14; closer in, the phone
**overzooms**, drawing zoom-14 data larger. The pyramid to zoom 14 is (4^15 − 1) ÷ 3 ≈ 358
million tiles, about 107 million at 30% land (empty ocean tiles are stored
once and shared). At 20 KB average that is about **2.1 TB**, and one copy
serves every style and every screen density, because styling happens on the
phone. The cost moves to the client: drawing takes CPU, GPU and battery, and old
phones struggle.

Vector tiles win at this scale: 2.1 TB against petabytes, styles that change
without regenerating anything, and upright labels on a rotating map. The few
clients that need an image, such as a static map embedded in a web page, get
one rendered on demand from the vector tiles and cached at the CDN.

**Keeping tiles fresh.** The daily build changes some tiles and leaves most
untouched. How the CDN finds out decides both staleness and origin load.

- **One version in every URL** (`/tiles/v2026-09-29/...`). Nothing is ever
  stale, but each daily release changes every URL at once, so the CDN
  starts cold: for a while nearly all 350,000 requests a second at peak miss
  and hit the tile store, twenty times the 17,500 it's sized for.
- **Stable URLs with a short cache lifetime** (say 6 hours). No cold start,
  but a changed road shows old data for up to 6 hours, and purging only the
  changed URLs means millions of purge calls per release.
- **A version per block.** Split the world into the 4,096 tiles of zoom 6
  (each about 600 km across), each with its own version number, listed in a
  16 KB manifest (4,096 × 4 bytes) cached for 5 minutes. A tile URL carries
  its block's version (`b41` above), so a build that changes one city bumps
  one block and only its tiles miss. The 1,365 tiles below zoom 6 share one
  version.

This design uses per-block versions: one more small request per app start
and a build step that diffs each block against the last build, in exchange
for URLs that never go stale and misses only where the map changed. It
sidesteps the problem [cache invalidation](/systems-and-infrastructure/cache-invalidation)
is about by never changing what a URL holds.

## Deep dive: routing with live traffic

The road graph is a **directed graph**: intersections are nodes, one-way
segments are edges, and each edge's **weight** is its travel time. The
fastest route is the lowest-weight path. Travel time is length ÷ speed, and
the speed comes from the live array if the segment has a live value,
otherwise from its historical curve for the current 15 minutes.

**Option 1: Dijkstra's algorithm on the raw graph.** Dijkstra explores
outwards from the start in order of travel time until it reaches the
destination. It needs no preparation, so it reads the newest weights on every
search. But a long drive explores every intersection closer in travel time than
the destination, millions of them. Even with A\* (Dijkstra guided by the
straight-line distance to the goal), long searches take hundreds of
milliseconds to seconds; at half a second each, 20,000 a second would keep
10,000 cores busy.

**Option 2: contraction hierarchies (CH).** Preprocessing ranks nodes by
importance (a residential corner low, a motorway junction high) and adds
**shortcut** edges that skip less important nodes. A search climbs towards
more important nodes from both ends and meets in the middle, touching a few
hundred nodes: well under a millisecond. But the shortcuts are computed from
the weights, and rebuilding them takes minutes, so with weights changing every
minute the hierarchy is always out of date.

**Option 3: customizable route planning (CRP).** CRP splits preprocessing
into two parts. The first, done once per graph version by the map build
pipeline and independent of travel times, cuts the graph into **cells**, regions of a few thousand
intersections chosen so that few roads cross their borders, then groups those
into larger cells, several levels deep. The second, called
**customization**, computes for each cell the travel time between every pair
of its border points under the current weights. A search runs Dijkstra
normally near the start and the destination, and in between moves across
whole cells using those precomputed border-to-border times. Queries touch
thousands of nodes rather than millions, a few milliseconds. Published
results put a full customization for a continent-sized graph at about a
second or less on a multi-core server; this design assumes up to 10 seconds for the
world graph on 32 cores. Customizable contraction hierarchies (CCH) separate
structure from weights in the same way and would also work.

CRP fits these numbers best. Its queries are slower than CH's, but at 10 ms
per search (with alternatives and drawable lines) 20,000 a second is the 200
cores from the estimates, and its weights can be refreshed every minute. A
delta usually touches only some cells, and only those and their parent cells
need customizing again; the sizing below assumes a full customization every
minute anyway.

**Capacity.** Customizing every minute costs 10 s × 32 cores = 320
core-seconds a minute. On every core it would crowd out searches and their
p99, so it is capped at 8 cores and takes 320 ÷ 8 = **40 s**, about 5.3 cores
continuously per server. Run 21 servers with 32 cores each, 7 in each of three
regions:

- Normal peak: 200 search cores + 21 × 5.3 ≈ 111 customization cores = 311
  of 672 cores, **46%**; while customization runs, searches have 21 × 24 = 504
  cores, 40% busy.
- One region lost: 200 + 14 × 5.3 ≈ 74 = 274 of 448 cores, **61%**; searches
  during customization, 200 of 14 × 24 = 336 cores, 60%.

Memory per server is 256 GB. It holds two graph versions during a switch (2 ×
70 GB), the historical curves (2.1 GB), the live speeds (1.4 GB), its
sessions' routes (1–1.5 GB) and working space for searches: about 147 GB,
leaving over 40% free.

**ETAs.** The search uses current speeds everywhere, which is wrong for a
road the driver reaches in an hour, after rush hour may have ended. So the
server then walks the chosen route in order, using live speeds for segments
reached within about 30 minutes and the historical curve at the arrival time
beyond. That gives the ETA, though not necessarily the fastest route for
time-varying speeds (a search over arrival times is much slower); the reroute
check every 60 seconds catches up as the trip goes on.

**Switching graph versions.** A segment index is a position in one graph
version's arrays, so a new graph changes what every live speed, delta and
matched segment means. The map build pipeline partitions each new graph
offline and ships the partition with it; servers only customize. Matchers
and aggregators switch to the new version at a set window; for that window
they write a full snapshot keyed to the new version, and a server customizes
the new graph (loaded next to the current one) only once that snapshot has
loaded. The old graph gets no more live speeds, so its sessions get fresh
routes at their next reroute check.

## Deep dive: live traffic from probes

Turning probes into speeds takes three steps. **Map matching** decides which
segment each GPS point was on; readings drift by 10 m or more, which in a city
can be another street. The usual technique, a hidden Markov model, scores
candidate roads by distance from the point and by whether the move from the
previous point is a plausible drive, so it needs a trip's points in order.
**Aggregation** turns the cars' times across a segment into one speed per
window. **Publishing** gets the speeds to 21 routing servers.

**How to aggregate: micro-batches or a stream.**

- A **micro-batch** job every 5 minutes reads the probes collected since the
  last run, matches and averages them, and writes a speed file. Each run is a
  plain restartable job, but 5 minutes plus the run time misses the 3-minute
  freshness target.
- A **stream processor** keeps running state and closes a window every
  minute. Its state is lost on a crash and must be rebuilt from the queue,
  but it can meet the target.

This design streams, in two stages. The probe queue is split into
**partitions** (independent ordered logs, as
[message queues](/systems-and-infrastructure/message-queues) describes) keyed
by `session_id`, so each trip's batches reach one matcher in order. A
matcher drops any batch whose `seq` it has already seen for that session,
matches points to segments, and emits one **traversal** per segment crossed:
session, segment, time taken. A car crawling through a 1 km jam at 5 km/h
leaves its segment only after 12 minutes, so every minute the matcher also
emits a **partial traversal** for a segment not yet left, with the distance
covered so far, which the aggregator scales to the segment's full length.
Traversals are published to a second topic keyed
by geography: 64 **traffic partitions**, each a group of spatial cells, so all
traversals of one segment reach one aggregator. At the peak of 1 million
probes a second, a matcher budget of 20 µs a point is 20 cores busy, 40 at 50%
headroom. The queue keeps three days of probes, 4.5 TB, ×3 copies ≈ 13.5 TB;
a separate consumer archives them to object storage for the weekly historical
curves.

For each segment and one-minute window, the aggregator keeps at most one
traversal per session and averages travel times rather than speeds (the
average of speeds overstates how fast a road is when some cars crawl). A
segment needs traversals from at least three sessions in a window to get a
new speed, so one phone faking a jam can't move a road alone. After 5
windows with no new speed, the delta carries an "expired" entry (speed 0)
and routing falls back to the historical curve.

**How to publish: push every change, or files and a pointer.** Publishing
each new speed as a message every routing server consumes is simple, but a
restarting server has to replay the stream from somewhere to rebuild 1.4 GB
of state. The alternative is an immutable
**delta file** per traffic partition per window, holding only segments whose
speed changed by more than 10%, plus a small **pointer** row per partition
naming the newest window. Assume 50 million segments have live data and 10%
change each minute: 5 million × 8 bytes ≈ 40 MB a minute across all 64
partitions, and 21 servers × 40 MB ≈ 14 MB/s of reads from object storage. A
full snapshot (50 million × 8 bytes ≈ 400 MB) is written every 10 minutes, so
a restarting server loads the latest snapshot and at most ten deltas. This
design uses files and a pointer.

![Sequence of one minute of live traffic for partition P. The phone uploads a batch carrying its session and seq to the probe queue (through the API gateway, not shown). The aggregator receives matched traversals, closes window W, writes delta file P/W/e (e is its epoch) to the snapshot store, then does a compare-and-set on P's pointer from W-1 to W, and only then commits its queue offsets. A routing server polls the pointers, learns P is at W, fetches delta P/W/e, and receives the speeds.](/diagrams/maps/traffic-sequence.svg)

**The write path, and what happens on a crash.** Each traffic partition is
owned by one aggregator at a time, which holds a **lease** on it: a claim that
expires unless renewed, granted with an **epoch** number that goes up each
time the partition changes owner. Leases and the pointer rows live in a small
consensus-based store such as etcd, where a compare-and-set costs a few
milliseconds of replication; at 64 partitions once a minute that is about
one a second. When window W closes on partition P:

1. **Write the delta file** `P/W/e`, named by partition, window and the
   writer's epoch _e_, and never overwritten. A crash here leaves either no
   file or a file nothing points to; the next owner, with a higher epoch,
   recomputes W from the queue and writes its own file.
2. **Compare-and-set the pointer**, a write that succeeds only if the row
   still holds the expected values: set P's row to window W, the writer's
   epoch and the file name only if the row currently says window W−1 and an epoch no higher than
   the writer's. A crash after this step but before step 3 means the next
   owner replays W from the queue, finds the pointer already at W, skips the
   write and moves on to W+1, so W is never published twice.
3. **Commit the queue offsets** up to the end of W. Until this happens, the
   probes of W are still in the queue, so nothing is lost if the aggregator
   dies.

The epoch check covers what a lease alone can't: an aggregator that stalls
in a long garbage-collection pause, loses its lease, and wakes believing it
still owns P. On taking the lease, the new owner first writes its epoch into
P's pointer row with a compare-and-set, so any later write carrying an older
epoch fails. Any file it wrote has its old
epoch in the name, so it can't replace the file the pointer names. The epoch works as a fencing
token, as [distributed locks](/systems-and-infrastructure/distributed-locks)
explains. A routing server applies delta W only if it holds W−1, so no delta
is applied twice or out of order; on a gap it loads the newest snapshot. If a
partition's pointer is more than 5 minutes old, the server ignores that
partition's live speeds.

Where duplicates remain and where data can be lost:

- A retried upload repeats a batch; the matcher drops it by `seq`. After a
  matcher crash its memory of `seq` values is gone, so replayed batches
  produce repeat traversals, and the aggregator's one-traversal-per-session
  rule absorbs them.
- Probes arriving more than 20 seconds after their window closes, such as a
  phone that lost signal in a tunnel, miss the live speeds. They still reach
  the archive and the historical curves.
- If the whole pipeline stops, nothing already queued is lost within the
  three days of retention, but live speeds go stale and routing drops back to
  historical curves once the pointers are 5 minutes old. Probes a phone never managed to upload
  are gone.

**Freshness, added up.** Up to 10 s waiting for the next upload, about 5 s
for each of the two queue hops (to the matcher, then to the aggregator), 60 s
for the window, 20 s for late probes, about 5 s to write and publish, up to
10 s until the next poll, and 40 s to customize: about 155 s, or 2 minutes 35
seconds, in the worst case. That is why the requirement is 3 minutes: a
2-minute target would need shorter windows, which hold fewer cars each, so
speeds would be noisier.

## Failure modes and bottlenecks

**A surge in probes.** A holiday getaway can exceed the planned peak. The
queue absorbs the backlog while matchers and aggregators catch up, and
freshness slips meanwhile. If the queue refuses writes, the gateway answers
`503` and the phone keeps the batch for its next upload.
[Backpressure](/systems-and-infrastructure/backpressure) covers the choice
between buffering, slowing senders and shedding load.

**A release cold-starts the CDN.** With per-block versions this is limited to
the blocks that changed, but a build that touches everything (a new label
font, a data fix applied worldwide) still changes every block. Such builds are
rolled out a few hundred blocks at a time, so misses arrive as a slope rather
than the burst described in
[the thundering herd problem](/systems-and-infrastructure/thundering-herd-problem).

**A bad graph version.** An export can contain a mistake, such as a bridge
marked closed. Each new graph is checked by replaying a sample of
yesterday's route requests and blocked if ETAs shift sharply; one that slips
through is rolled back to the previous version, still in memory. A real
closure doesn't wait for the build: an operator marks the segments closed
and the traffic pipeline sends them out as a speed of zero.

**Losing a routing server or a region.** Every routing server holds the whole
graph, so any server can answer any request, and a region's loss is covered
at 61% CPU, as worked out in the second deep dive; its navigation sessions
rehash to other servers and resend their route tokens once. A starting server takes a
few minutes to load 70 GB and the latest traffic snapshot before the gateway
sends it traffic.

**Fake traffic.** Someone driving slowly with many phones can paint a jam.
The three-session threshold and a cap on sessions per device or network raise
the cost without ruling it out.

**Knowing it's happening.** Watch the CDN hit rate, route search p99, the
age of each traffic partition's pointer, queue lag, and ETA error measured
on completed trips.
[Observability](/systems-and-infrastructure/observability) covers how metrics,
logs and traces divide that work.

## Trade-offs

- **Vector tiles over raster.** About 2.1 TB instead of a petabyte-scale
  image set, with styles that change without a rebuild; the phone pays in
  drawing work and battery, and old devices draw less smoothly.
- **CRP over contraction hierarchies.** Searches take a few milliseconds
  instead of well under one. That is what it costs to fold new traffic into
  routing every minute, and at 20,000 searches a second it is affordable.
- The whole graph on every routing server means no route crosses a shard
  boundary, but every server needs 256 GB and minutes to start. Splitting by
  continent is the next step if the graph outgrows one machine.
- **Current speeds for the search, time-varying speeds for the ETA.** Much
  cheaper than a proper time-dependent search; a route that would only be
  best because rush hour ends mid-trip is missed until a reroute check finds
  it.
- **One-minute windows with a three-session minimum.** Fresh enough for the
  3-minute target, but a quiet road with fewer than three cars a minute has
  no live speed and is routed on its history.
- **Files and a pointer for traffic.** Restarts are cheap and a delta can't
  be applied twice, at the cost of a consensus store in the path and up to 10
  seconds of polling delay.

Adding walking and cycling would mostly add weights, since CRP's cells don't
depend on travel times and can be customized once per mode. Transit would
need a second engine that searches timetables.
