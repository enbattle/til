---
title: Design a Maps and Navigation Service (like Google Maps)
summary: Vector map tiles served from a CDN, routing that re-weights a pre-cut road graph every minute, and live traffic built from navigating phones' GPS points, for 350,000 tile requests a second at peak.
date: 2026-10-05
order: 12
template: 2
---

You're asked to design a service like Google Maps. A driver types "blue bottle coffee" and asks the way there. That is three jobs on
one picture of the world: drawing the map, **geocoding** (turning
a name or address into a point, and back), and routing with an **ETA**
(estimated time of arrival) that reflects current traffic, which comes from
the phones being routed.

## Requirements

- Pan and zoom the whole world: a map tile in under 100 ms at p99 (99% of
  requests are faster), for 100 million daily users.
- Search places with suggestions as you type (under 150 ms at p99), and turn a
  tapped point into an address.
- Route with up to three alternatives and an ETA in under 1 second at p99,
  and offer a faster route when traffic changes. 20 million navigation
  sessions a day, 25 minutes each.
- A slowdown that phones see reaches routing within 3 minutes. If live traffic
  fails, routing falls back to typical speeds for that time of week.
- Tiles 99.99% available, search and routing 99.95%.

Out of scope: walking and transit, offline maps and editing the map.

## Key numbers

These size the CDN and tile store, the probe pipeline, the routing servers and
the road graph. Assume peak is 3 times average, since users span time zones
([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

- **Tiles: about 350,000 requests a second at peak.** A **tile** is one square
  of the map. At an assumed 100 tiles per user a day, 10 billion ÷ 86,400 ≈
  116,000, × 3. A 95% CDN hit rate leaves 17,500 for the tile store.
- **Probes: 1 million a second, in 100,000 uploads.** A **probe** is one GPS
  reading from a navigating phone. 20 million × 25 minutes ÷ 1,440 ≈ 347,000
  sessions, × 3 ≈ 1 million, each sending a probe a second in 10-second
  batches.
- **Routes: about 20,000 searches a second, 200 cores.** 3,500 new routes
  (one per user a day, peak ×3) plus a reroute check a minute from each
  session (16,700), at an assumed 10 ms of CPU each.
- **Road graph: 70 GB, plus 1.4 GB of live speeds.** An assumed 700 million
  one-way road segments × 100 bytes; one 2-byte live speed per segment.

## High-level architecture

![Architecture of the maps service. The mobile or web client fetches tiles and the tile manifest from the CDN, which reads the tile store in object storage on a miss. Search, route and probe-upload requests go to the API gateway, which sends them to the search service and place index, the routing servers, and the probe queue. Traffic aggregators consume the probe queue and write deltas and a pointer to the speed snapshot store, which the routing servers poll to load deltas. An offline map build pipeline produces the tiles, the road graph for the routing servers, and the places for the search service.](/diagrams/maps/architecture.svg)

Your phone fetches tiles from the **CDN**, [caches](/systems-and-infrastructure/caching)
in many cities that answer 19 requests in 20; a miss reads the **tile store**.
Everything else goes through the **API gateway** to the **search service**, the **routing servers** or the **probe queue**.
**Traffic aggregators** read the
[queue](/systems-and-infrastructure/message-queues) and write speed changes to
the **speed snapshot store**, which routing servers poll. A daily offline
**map build pipeline** produces the tiles, the road graph and the place data.

## API and data model

```http
GET /search?q=blue+bottle&near=37.776,-122.423&limit=5   (and /reverse?lat=..&lng=..)
POST /routes  { "origin": [37.776,-122.423], "destination": [37.335,-121.893], "alternatives": 3 }
-> { "routes": [{ "polyline": "...", "eta": "...", "route_token": "..." }] }
POST /navigation/{session_id}/updates  { "seq": 118, "points": [ ...10 probes... ] }
-> { "eta": "2026-10-05T09:14:00Z", "better_route": null }
```

```text
place:    place_id, name, lat, lng, address, popularity, cell_id
segment:  index (0..699,999,999) -> from, to, length, road class, speed curve
tile:     {block_version}/{z}/{x}/{y}.mvt   (a file; z is the zoom level)
```

`cell_id` turns "near here" into "this cell or its neighbours", a lookup an ordinary
[index](/systems-and-infrastructure/database-indexing) answers.
A segment's `index` is its position in every in-memory array, so a live speed is one array write. `seq` lets retries be recognised.

## Decision: vector tiles

Each tile holds **vector** data (road lines, building outlines, label
positions), and the phone draws it with a style file. Tiles stop at zoom 14,
about 2.4 km a side. Zoom z has 4^z tiles, so zooms 0 to 14 total 358 million; with 30% holding land, that is 107 million × an assumed 20 KB ≈ 2.1 TB, one
copy for every style.

Why not **raster** tiles, ready-made images? They cost the phone nothing, but
street level needs zoom 18: 20 billion land tiles, 300 TB at an assumed 15 KB
for one style and density. Day and night at 1×, 2× and 3× make six variants,
over 1.8 PB, and labels baked into pixels turn sideways when the map rotates.
Vector moves the cost to the phone's GPU and battery.

**Rule of thumb.** When many clients want different renderings of the same
data, ship the data and let the client render it.

## Decision: routing that re-weights every minute

Intersections are nodes, one-way segments are edges, and travel time is the
weight. Plain **Dijkstra** explores everything nearer than the destination, millions
of nodes: at half a second a search, 20,000 a second needs 10,000 cores.
Preprocessing must survive weights that change every minute.

This design uses **customizable route planning**. The map build cuts the graph
once into cells with few roads crossing their borders. When new speeds load, **customization** recomputes travel times between each cell's border points
from current speeds, and a search crosses whole cells in one hop: a few
milliseconds. Assume customization takes 10 seconds on 32 cores; capped at 8 cores per server, leaving the rest for searches, it takes 40 seconds.

Why not **contraction hierarchies**? They answer in under a millisecond, but
their **shortcuts** (pre-computed paths skipping stretches of road) depend on today's travel times, and a rebuild takes minutes, so they would always be out of date.

**Rule of thumb.** Pre-compute whatever doesn't change, and keep what does
change cheap to refresh.

## Decision: live traffic as one-minute windows

The aggregators assign each probe to a road segment (**map matching**, since
GPS drifts 10 m or more), average travel times per segment each minute, and
publish only the changes, as files plus a pointer to the latest. A segment
needs three different sessions, so one phone can't fake a jam. If pointers go
five minutes stale, routing falls back to typical speeds.

Why not a batch job every 5 minutes? It is simpler, but its 5-minute window alone can break the 3-minute target. The streamed path's
worst case is 155 s: 10 s for an upload, 10 s in queues, a 60 s window, 20 s
for late probes, 5 s to publish, 10 s to the next poll, 40 s to customize.

**Rule of thumb.** Add up the freshness budget stage by stage, and pick the
simplest design whose worst case fits.

## Likely follow-ups

- **How does search find "blue bottle" near you?** The place index is split
  into shards by region, and `near` picks the shard. Prominent places are
  copied to every shard, so "Eiffel Tower" typed in New York works ([sharding](/systems-and-infrastructure/partitioning-vs-sharding)).
- **How does a map release avoid a cold CDN?** Each zoom-6 block (4,096 of
  them) has its own version in tile URLs, listed in a 16 KB manifest the phone caches for 5 minutes, so only changed blocks miss
  ([cache invalidation](/systems-and-infrastructure/cache-invalidation)).
- **How is the ETA updated every 10 seconds?** The session's routing server
  keeps its route in memory (a 60 km route is about 5,000 segments × 4 bytes =
  20 KB; 1 million sessions = 20 GB) and re-sums the remaining segments.
  Resending it would be 2 GB/s. The reroute check each minute is a full search
  (the routing [ride-sharing](/system-design/ride-sharing) also calls).
- **What if an aggregator crashes mid-window?** It commits its queue position
  only after writing its delta file and moving the pointer, so the next owner
  replays the window, and an epoch number on its lease fences off a stalled
  old owner ([distributed locks](/systems-and-infrastructure/distributed-locks)).
