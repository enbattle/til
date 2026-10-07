---
title: Data Representation
summary: Every value is stored as bits in a fixed shape, and integers, decimals, text and serialized messages each fail in their own predictable way.
date: 2026-10-07
---

Picture one line in a shopping cart: three cups of "Café 👍🏽" at $19.99 each, on order 9007199254740993. A computer holds all four facts as the same raw material, and each one can quietly go wrong. Walking through how it's stored shows where.

## Bits and bytes

A **bit** is a single 0 or 1. A **byte** is eight bits, so it can hold 256 different patterns. Memory has no idea what a pattern means. The same byte can be the number 65 or the letter "A", and only the program reading it decides which. Everything below is a set of agreements about how to read patterns.

For bit-level tricks on integers, see [bit manipulation](/dsa/bit-manipulation).

## Fixed-width integers and overflow

The quantity, 3, is stored as an integer. Most languages give integers a fixed width, such as 32 bits. Why fixed? Because the hardware does arithmetic on fixed-size chunks, which is fast. The cost is a ceiling. A signed 32-bit integer (one that can be negative) tops out at 2,147,483,647.

What happens at 2,147,483,648? It depends on the language. In Java and in most hardware, the value wraps around to -2,147,483,648. In C, signed overflow is undefined behavior, so the compiler may assume it never happens. Python's integers grow as needed and never overflow, at some cost in speed.

The order ID, 9007199254740993, is far past 32 bits, so it needs a 64-bit integer (ceiling about 9.2 quintillion). The alternative is always reaching for the biggest width, but that doubles the memory and bandwidth for every small value.

## Floating point

The price is $19.99, which isn't a whole number. A **floating-point** number stores a value as a sign, a scale and a fixed number of significant binary digits, the way scientific notation stores 1.999 × 10¹. The common format is the IEEE 754 double, which is 64 bits.

The catch: many decimal fractions, like 0.1, have no exact binary form, just as 1/3 has no exact decimal form. The stored value is the nearest one that fits. That is why 0.1 + 0.2 gives 0.30000000000000004. For graphics or physics, that tiny error doesn't matter, and floats win on range and speed.

For money, it does matter, because errors add up and totals must match to the cent. Store the price as an integer count of cents, 1999, so three cups total exactly 5997. A decimal type, which stores base-10 digits exactly, is the other option. It wins when you need fractions of a cent or varying currencies, and it costs speed.

## Text: code points and bytes

The name "Café 👍🏽" is text. **Unicode** gives every character a number called a **code point**. It doesn't say how to store that number. An **encoding** does, and the dominant one is **UTF-8**, which uses 1 to 4 bytes per code point: 1 for plain English letters, 2 for "é", 4 for emoji. Why variable? English text stays compact, and plain ASCII files are already valid UTF-8.

Now the interview question: how long is the name? It depends on what you count.

| You count                         | Result |
| --------------------------------- | ------ |
| UTF-8 bytes                       | 14     |
| Code points                       | 7      |
| JavaScript's UTF-16 code units    | 9      |
| What a user sees as one character | 6      |

The thumbs-up and the skin-tone swatch are two code points that render as one symbol. JavaScript strings store UTF-16, an encoding that spends 2 bytes on most characters and 4 on emoji, so `.length` counts those 2-byte units, and each emoji counts as two. Counting bytes is right for storage limits. Counting what the user sees is right for a "40 characters max" form field. Truncating by bytes can slice an emoji in half and leave broken text. Models read text in yet another unit; see [tokenization](/ai-and-ml/tokenization).

## Serialization: JSON vs. a binary format

To send the cart line to a server, you **serialize** it, which means turning in-memory values into bytes. The usual choice is JSON, a text format:

```json
{ "orderId": 9007199254740993, "cents": 1999, "qty": 3, "name": "Café 👍🏽" }
```

Why is it popular? You can read it, and every language parses it. Two costs show up here. JavaScript parses every JSON number as a double, which holds every whole number exactly only up to 2^53 (9,007,199,254,740,992). Our order ID is one past that, so JavaScript reads it back as 9007199254740992, a different order. The usual fix is sending big IDs as strings. And the field names travel with every message, which wastes space at scale.

A binary format like Protocol Buffers addresses both. You write a **schema**, a file declaring each field's name, type and number, and messages carry only the numbers and packed values. A 64-bit ID stays a 64-bit integer on the wire, though a JavaScript client still needs a library that decodes it as a bigint or a string. The price is that nobody can read the bytes without the schema, and both sides must share it. The numbers are also what let a format change safely: add a gift-message field with a new number and older readers skip it, while reusing or renumbering an old field breaks them. Sharing a schema is why [gRPC](/computing-fundamentals/rest-vs-grpc-vs-graphql) uses it between internal services, while public APIs mostly stay on JSON.

**Rule of thumb.** Pick the representation for the worst value it must hold: integers wide enough for the largest ID, exact integers or decimals for money, and a stated unit for text length. Whenever a value crosses a boundary, check that both sides read the same bits the same way.
