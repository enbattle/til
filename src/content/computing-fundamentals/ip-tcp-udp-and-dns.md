---
title: IP, TCP, UDP and DNS
summary: How a name like shop.example.com becomes an address, and how your machine opens a reliable connection to the program behind it.
date: 2026-10-07
---

You type `shop.example.com` into a browser and press Enter. Before a single byte of the home page moves, your machine has to answer two questions: where is that server (a lookup called DNS, covered below), and how do we talk to it reliably? This page follows that one request up to the moment a connection to the shop's server is open. [HTTP and HTTPS](/computing-fundamentals/http-and-https) pick up from there.

## IP addresses

Machines on a network find each other by an **IP address**, a number that identifies a network interface. IPv4 addresses are 32 bits, written like `203.0.113.7`. There are only about 4.3 billion of them, which ran short, so IPv6 uses 128 bits, written in hexadecimal like `2001:db8::7`.

Data travels as **packets**, small chunks with the destination address stamped on each. Routers pass a packet along one hop at a time, each choosing the next hop toward the destination. Nobody guarantees delivery. A router can drop a packet when it is overloaded, and two packets of the same message can take different paths and arrive out of order.

That raises a problem. One machine runs a browser, a mail client and a chat app at once, so which program should receive a packet?

## Ports

A **port** is a number from 0 to 65535 that names a program on a machine. The IP address finds the machine, and the port finds the program. Web servers conventionally listen on port 80 (plain) and 443 (encrypted), and DNS servers on port 53. Your browser gets a temporary port of its own so replies find their way back.

IP and ports still only move packets. Something on top has to decide what happens when one is lost, and there are two common answers.

## TCP

**TCP** (Transmission Control Protocol) makes a lossy network look like a reliable pipe. The shop's server needs the page's bytes complete and in order, so your browser uses it. Three things make that work:

- **A handshake.** Before data flows, the two sides exchange three small messages to agree on starting numbers: you send SYN, the server answers SYN-ACK, you send ACK. Your side can start sending data right after, so the handshake costs one **round trip**, the time for a message to reach the server and a reply to come back.
- **Ordered, retransmitted delivery.** Every byte is numbered. The receiver acknowledges what arrived, puts packets back in order, and the sender resends anything not acknowledged in time.
- **Congestion control.** When packets start getting lost, TCP reads that as a sign the network is crowded and slows its sending, then speeds up again gradually.

What does that cost? The handshake delays the first byte, and a single lost packet holds back everything behind it until the resend arrives.

## UDP

**UDP** (User Datagram Protocol) adds almost nothing to IP: ports and a checksum, and that's it. There is no connection, no ordering, no resending and no slowing down. You send a packet and hope.

Why would anyone want that? Because in a video call, a frame from 200 milliseconds ago is worthless, so waiting for its resend only stalls the frames that matter. Games and calls tolerate a small loss and can't tolerate a delay. DNS uses UDP for a different reason: a lookup is one small question and one small answer, so a whole handshake would cost more than the exchange itself. An application that wants some reliability on UDP adds it itself, such as retrying a lookup that went unanswered.

So TCP wins when every byte must arrive, and UDP wins when fresh data beats complete data or the exchange is tiny.

## DNS

Your browser has `shop.example.com`, but TCP needs an IP address. **DNS** (the Domain Name System) is the distributed lookup that turns one into the other. Who does the lookup?

1. Your machine's **stub resolver**, a minimal built-in client, asks a **recursive resolver**, usually run by your ISP or a public provider. It does the legwork for you.
2. If the recursive resolver doesn't already know, it asks a **root server**, which doesn't know the answer but points to the servers for `.com`.
3. A **top-level-domain (TLD) server** for `.com` points to the servers responsible for `example.com`.
4. That domain's **authoritative server**, the one holding the real records, answers with the shop's IP address.

The recursive resolver hands the answer back, and your browser opens a TCP connection to that address on port 443. The handshake from earlier runs, and the connection is open.

This would be slow if it ran every time, so each answer carries a **TTL** (time to live), a number of seconds it may be cached. Your browser, your operating system and the recursive resolver all keep answers until the TTL expires, so most lookups never reach the root or TLD servers at all. This is the [caching](/systems-and-infrastructure/caching) trade-off again: speed in exchange for staleness.

That is why a DNS change takes time. If the shop moves to a new server and updates its record, resolvers around the world keep serving the old address until their cached copies expire. If the record's TTL is 3,600 seconds, a move can take up to an hour to reach everyone. So lower it to 60 seconds at least an hour before a planned move, letting the old long-lived copies expire first, and the switch then spreads within a minute.

**Rule of thumb.** Names are cheap to change but slow to spread, so give DNS records a short TTL before you move, and pick TCP when every byte must arrive and UDP when a late byte is worth nothing or the whole exchange is one small packet each way.
