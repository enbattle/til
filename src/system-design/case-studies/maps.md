---
title: Design a Maps and Navigation Service (like Google Maps)
summary: Vector map tiles served from a CDN, routing that re-weights a pre-cut road graph every minute, and live traffic built from navigating phones' GPS points, for 350,000 tile requests a second at peak.
date: 2026-10-05
order: 12
template: 3
---

You're asked to design a service like Google Maps. A driver types "blue bottle coffee", taps the first result and asks the way there. That is three jobs on one picture of the world: drawing the map, **geocoding** (turning a name or address into a point, and back), and routing with an **ETA** (estimated time of arrival) that reflects current traffic, which comes from the phones being routed.

The hardest job is routing: finding the fastest way across millions of roads, thousands of times a second, while road speeds change every minute. This page starts with the obvious search and shows where it breaks, then follows a request through the design that fixes it, sizes the parts, and makes three decisions: how the map is drawn, how routing keeps up with changing speeds, and how live traffic reaches it.

## Requirements

- Pan and zoom the whole world: a map **tile** (one square of the map) in under 100 ms at p99 (99% of requests are faster), for 100 million daily users.
- Search places with suggestions as you type (under 150 ms at p99), and turn a tapped point into an address.
- Route with up to three alternatives and an ETA in under 1 second at p99, and offer a faster route when traffic changes. 20 million navigation sessions a day, 25 minutes each.
- A slowdown that phones see reaches routing within 3 minutes. If live traffic fails, routing falls back to typical speeds for that time of week.
- Tiles 99.99% available, search and routing 99.95%.

Out of scope: walking and transit, offline maps and editing the map.

## Start simple: routing

Start with the part that sounds hardest, finding the fastest way from A to B. Draw the roads as dots and lines: each dot is an intersection, and each line is a **segment**, a one-way stretch of road between two intersections, labeled with the minutes it takes to drive. A map drawn this way is a **road graph**.

To route, give your origin the time 0 and write down the time to reach each intersection one segment away. Then repeat one step: take the intersection with the smallest written time that you haven't finished, and lower the times of the intersections just beyond it if this way is quicker. When the intersection you take is your destination, stop. Everything unfinished is slower to reach, so its time is the fastest. This is **Dijkstra's algorithm**.

For a town, that's instant. Assume the search spends 0.0001 ms on an intersection:

```text
town search, worst case:
  10,000 intersections × 0.0001 ms = 1 ms
```

But the search spreads outward from the origin like a ripple, finishing every intersection quicker to reach than the destination before it gets there. Assume a 60 km route ripples over 5 million intersections. This app also searches again each minute for every driver who is navigating, a **reroute check** that looks for a faster way. Peak is 3 times average, since users span time zones ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

```text
new routes at peak:
  100,000,000 users × 1 a day ÷ 86,400 s ≈ 1,160 a second
  1,160 × 3 ≈ 3,500
phones navigating at peak:
  20,000,000 sessions × 25 min ÷ 1,440 min a day ≈ 347,000
  347,000 × 3 ≈ 1,000,000
reroute checks, one a minute each:
  1,000,000 ÷ 60 s ≈ 16,700 a second
all searches:
  3,500 + 16,700 ≈ 20,000 a second

one ripple search:
  5,000,000 × 0.0001 ms = 500 ms
cores for 20,000 a second:
  20,000 × 0.5 s = 10,000
```

That's 10,000 processor cores doing nothing but ripples. So skip the ripple. Before anyone asks for a route, work out the driving time across long stretches of road and store each as one extra segment that jumps over the small roads between: a **shortcut**. Search from the origin and from the destination at once, always moving toward bigger roads, and the two searches meet after a few hundred intersections. This precomputation is called **contraction hierarchies**, and it answers in under a millisecond. Assume 10 ms of CPU per search, everything included:

```text
cores with shortcuts:
  20,000 × 0.01 s = 200
```

200 cores is 50 times fewer. But a shortcut is only as true as the speeds it was built from, and speeds change every minute. Where those speeds come from, and the rest of the service around the search, is the architecture.

## High-level architecture

![Architecture of the maps service. The mobile or web client fetches tiles from the CDN, which reads the tile store on a miss. Search, route and probe-upload requests go to the API gateway, which sends them to the search service and place index, the routing servers, and the probe queue. Traffic aggregators consume the probe queue and write speed changes and a pointer to the newest file to the speed snapshot store, which the routing servers poll to load the changes. An offline map build pipeline produces the tiles, the road graph for the routing servers, and the places for the search service.](/diagrams/maps/architecture.svg)

Your phone draws the map from tiles, and it fetches them from a **CDN**, caches in many cities ([caching](/systems-and-infrastructure/caching)). They answer 19 requests in 20. A miss falls through to the **tile store**, which holds every tile as a file. A job that runs offline each day, the map build pipeline, makes those tiles, the road graph and the place data.

Everything else goes through the **API gateway**, the front door that sends each request to its service. A search reaches the search service, which looks places up in its **place index**. A route request reaches the routing servers, which keep the road graph in memory with the precomputed data that speeds up searches, and run the searches from Start simple.

While you navigate, your phone also sends **probes**, GPS readings, through the gateway into a [queue](/systems-and-infrastructure/message-queues), a line that holds them until something takes them. The traffic aggregators read it, average the probes into current speeds, and write the changes to the speed snapshot store, which the routing servers poll. The third decision covers this path.

How big is each of these parts? That sets how many machines the design needs.

## Key numbers

These size the CDN and tile store, the routing servers, the probe pipeline and the road graph in memory. A day is 86,400 seconds, and peak is 3 times average.

- **CDN and tile store:** about 350,000 tile requests a second at peak. At an assumed 100 tiles per user a day, 100 million × 100 = 10 billion a day; 10 billion ÷ 86,400 ≈ 116,000 a second on average, × 3 ≈ 350,000. A 95% hit rate leaves 5% × 350,000 = 17,500 a second for the tile store.
- **Routing servers:** about 20,000 searches a second and 200 cores, as worked out in "Start simple". The 10 ms of CPU per search covers the chosen design's search (a few milliseconds, as the second decision shows) plus its alternatives and the response.
- **Probe pipeline:** 1 million probes a second, in 100,000 uploads. The 1 million navigating phones each send a probe a second, batched in 10 seconds: 1,000,000 ÷ 10 = 100,000 uploads a second.
- **Road graph:** 70 GB in each routing server's memory, plus 1.4 GB of live speeds. An assumed 700 million segments × 100 bytes = 70 GB; one 2-byte live speed per segment, 700,000,000 × 2 = 1.4 GB.

The routing line is why the second decision exists. First, the requests that carry all this.

## API and data model

```http
GET /search?q=blue+bottle&near=37.776,-122.423&limit=5   (and /reverse?lat=..&lng=..)
POST /routes  { "origin": [37.776,-122.423], "destination": [37.335,-121.893], "alternatives": 3 }
-> { "routes": [{ "polyline": "...", "eta": "...", "route_token": "..." }] }
POST /navigation/{session_id}/updates  { "seq": 118, "points": [ ...10 probes... ] }
-> { "eta": "2026-10-05T09:14:00Z", "better_route": null }
```

```text
place:    place_id, name, lat, lng, address, popularity, grid_id
segment:  index (0..699,999,999) -> from, to, length, road class, speed curve
tile:     {block_version}/{z}/{x}/{y}.mvt   (a file; z is the zoom level)
```

`grid_id` names the grid square a place sits in. It turns "near here" into "this square or its neighbors", a lookup an ordinary [index](/systems-and-infrastructure/database-indexing) answers. A segment's `index` is its position in every in-memory array, so a live speed is one array write. `seq` numbers each upload so a retry is recognized, and `route_token` lets the next update find the route again.

That's the shape. Now the first choice: how the map itself is drawn.

## Decision: vector tiles

The simpler option is **raster** tiles, ready-made images the phone just displays. Street level needs zoom 18. Zoom z has 4^z tiles, so assume 30% hold land and 15 KB per tile for one style and density:

```text
zoom 18 tiles holding land:
  4^18 ≈ 68.7 billion × 30% ≈ 20 billion
one style, one density:
  20 billion × 15 KB = 300 TB
day and night at 1×, 2× and 3× make 6 variants:
  300 TB × 6 = 1.8 PB
```

And labels baked into pixels turn sideways when the map rotates.

So each tile holds **vector** data instead (road lines, building outlines, label positions), and the phone draws it with a style file. Tiles stop at zoom 14, about 2.4 km a side; deeper zooms **overzoom**, scaling the zoom-14 data. One copy serves every style, at an assumed 20 KB a tile:

```text
tiles, zooms 0 to 14:
  4^0 + 4^1 + … + 4^14 ≈ 358 million
on land:
  358 million × 30% ≈ 107 million
store, once:
  107 million × 20 KB ≈ 2.1 TB
```

The cost moves to the phone's GPU and battery, which draw every tile.

**Rule of thumb.** When many clients want different renderings of the same data, ship the data and let the client render it. Once the map is drawn, it needs a route across it.

## Decision: routing that re-weights every minute

Contraction hierarchies are the fast option from "Start simple", and in this design they fail on freshness. Their shortcuts hold today's travel times, so a changed speed means rebuilding them. Assume a rebuild takes at least 10 minutes:

```text
rebuild:  10 min × 60 = 600 s (at least)
target:   3 min × 60 = 180 s
600 ÷ 180 ≈ 3.3 times too slow
```

Shortcuts would always be at least 10 minutes behind the traffic.

So make the part that changes small. Once, in the map build, cut the road graph into **cells**, patches of the map chosen so few roads cross their borders. The intersections where roads cross a border are its **border points**. Roads rarely change, so this cut can stay for a day.

When new speeds load, recompute the driving time between every pair of a cell's border points from the current speeds. That step is **customization**. A search then runs the plain ripple only inside the origin's and destination's cells, and crosses every cell between in one hop: a few milliseconds. The whole method is **customizable route planning**.

Assume customization takes 10 seconds on 32 cores. Capped at 8 cores per server, leaving the rest for searches:

```text
work:  10 s × 32 cores = 320 core-seconds
time:  320 ÷ 8 cores = 40 s
```

The price: a search takes a few milliseconds, not under one, and every minute each server gives a quarter of its cores (8 of 32) to customization for 40 seconds. So plan twice the 200 search cores, 400, for that and for headroom.

**Rule of thumb.** Pre-compute whatever doesn't change, and keep what does change cheap to refresh. The cell cut waits a day; the border-point times refresh in 40 seconds. Those times need current speeds, so where do they come from?

## Decision: live traffic as one-minute windows

The simpler option is a batch job every 5 minutes that reads the stored probes and writes new speeds. Its 5-minute window alone is 300 s, over the 3-minute target of 180 s. The streamed path adds up its worst case stage by stage:

```text
upload from the phone:      10 s
waiting in queues:       10 + 10 = 20 s
1-minute window:         20 + 60 = 80 s
late probes:             80 + 20 = 100 s
publish:                100 + 5 = 105 s
next poll by routing:  105 + 10 = 115 s
customization:         115 + 40 = 155 s
```

155 s leaves 25 s of headroom under 180 s. So the aggregators work in one-minute **windows**. They assign each probe to a road segment (**map matching**, since GPS drifts 10 m or more), average the travel times per segment, and publish only the changes, as a file plus a pointer to the newest. They write the file first, so a poller never follows a pointer to a missing file. A segment needs three different sessions, so one phone can't fake a jam. If pointers go five minutes stale, routing falls back to typical speeds.

The cost is more parts to run: a queue, aggregators and a pointer to keep correct. A quiet road with fewer than three sessions shows its typical speed, however slow it really is.

**Rule of thumb.** Add up the freshness budget stage by stage, and pick the simplest design whose worst case fits.

## Likely follow-ups

- **How does search find "blue bottle" near you?** The place index is split into **shards**, slices of the data each held by its own machines, by region, and `near` picks the shard. Prominent places are copied to every shard, so "Eiffel Tower" typed in New York works ([sharding](/systems-and-infrastructure/partitioning-vs-sharding)).
- **How does a map release avoid a cold CDN?** A cold CDN holds none of the new tiles, so every request would reach the tile store. Each zoom-6 block of tiles (4,096 of them) has its own version in tile URLs, listed in a version list of 4,096 × 4 bytes = 16 KB that the phone caches for 5 minutes, so only changed blocks miss ([cache invalidation](/systems-and-infrastructure/cache-invalidation)).
- **How is the ETA updated every 10 seconds?** The session's routing server keeps its route in memory: a 60 km route is about 1,000 segments × 4 bytes = 4 KB, and 1 million sessions = 4 GB. It re-sums the remaining segments, where resending the route each time would be 4 KB × 1 million ÷ 10 s = 0.4 GB/s. The reroute check each minute is a full search, the one [ride-sharing](/system-design/ride-sharing) also calls.
- **What if an aggregator crashes mid-window?** It records how far it has read the queue only after writing its file and moving the pointer, so the next owner replays the window. Each owner holds a **lease**, a time-limited claim on its share of the work, with a number that rises per owner, so a stalled old owner's late writes are rejected ([distributed locks](/systems-and-infrastructure/distributed-locks)).
