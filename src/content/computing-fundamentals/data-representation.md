---
title: Data Representation
summary: Every value is stored as bits in a fixed shape, and integers, decimals, text and serialized messages each fail in their own predictable way.
date: 2026-10-07
---

Picture one line in a shopping cart: three cups of "Café 👍🏽" at $19.99 each, on order 9007199254740993. A computer holds all four facts as the same raw material, and each can quietly go wrong. This page follows the line through integers, decimals, text and the bytes sent to a server.

## Bits and bytes

A **bit** is a single 0 or 1. A **byte** is eight bits, so it can hold 256 different patterns. The same byte can be the number 65 or the letter "A", and only the program reading it decides which. Everything below is a set of agreements about how to read patterns.

## Fixed-width integers and overflow

The quantity, 3, is stored as an integer. Most languages give integers a fixed width, such as 32 bits. The hardware does arithmetic on fixed-size chunks, which is fast, but the cost is a ceiling. A signed 32-bit integer (one that can be negative) tops out at 2,147,483,647.

What happens at 2,147,483,648? It depends on the language. In Java and in most hardware, the value wraps around to -2,147,483,648. In C, the language promises nothing about signed overflow (it is called undefined behavior), so the compiler may assume it never happens and the program can do anything at all.

The order ID, 9007199254740993, is far past 32 bits, so it needs a 64-bit integer (ceiling about 9.2 quintillion). Always using the biggest width would double the memory and bandwidth for every small value. The price has cents in it, which needs a different shape.

## Floating point

The price is $19.99, which isn't a whole number. A **floating-point** number stores a value as a sign, a scale and a fixed number of significant binary digits, the way scientific notation stores 1.999 × 10¹. The common format is the IEEE 754 double, which is 64 bits.

The catch: many decimal fractions, like 0.1, have no exact binary form, just as 1/3 has no exact decimal form. The stored value is the nearest one that fits. That is why 0.1 + 0.2 gives 0.30000000000000004. For graphics or physics that error is harmless, and floats win on range and speed.

For money, it does matter, because errors add up and totals must match to the cent. Store the price as an integer count of cents, 1999, so three cups total exactly 5997. A decimal type, which stores base-10 digits exactly, is the other option. It wins when you need fractions of a cent or varying currencies, and it costs speed.

Next is the name, and text has no single length.

## Text: code points and bytes

The name "Café 👍🏽" is text. **Unicode** gives every character a number, called a **code point**. It doesn't say how to store that number as bytes.

An **encoding** does. The dominant one is **UTF-8**, which uses 1 to 4 bytes per code point: 1 for plain English letters, 2 for "é", 4 for emoji. English text stays compact.

Now the interview question: how long is the name? It depends on what you count. JavaScript counts in **UTF-16 code units**: its strings store most characters in 2 bytes and emoji in 4, and each 2-byte piece is one unit.

| You count                         | Result |
| --------------------------------- | ------ |
| UTF-8 bytes                       | 14     |
| Code points                       | 7      |
| JavaScript's UTF-16 code units    | 9      |
| What a user sees as one character | 6      |

The working:

```text
bytes:          C a f é ␠ 👍 🏽  →  1+1+1+2+1+4+4 = 14
code points:    C a f é ␠ 👍 🏽  →  7
UTF-16 units:   5 (C a f é ␠) + 2 + 2  =  9
what you see:   C a f é ␠ 👍🏽  →  6
```

The thumbs-up and the skin-tone swatch are two code points that render as one symbol. JavaScript's `.length` returns the UTF-16 count, so each emoji adds two.

Count bytes for storage limits, and what the user sees for a "40 characters max" field. Truncating by bytes can slice an emoji in half. Models use yet another unit: see [tokenization](/ai-and-ml/tokenization). Text is settled, but the cart line still has to leave this machine.

## Serialization: JSON vs. a binary format

To send the cart line to a server, you **serialize** it, which means turning in-memory values into bytes. The usual choice is JSON, a text format:

```json
{ "orderId": 9007199254740993, "cents": 1999, "qty": 3, "name": "Café 👍🏽" }
```

JSON is readable and every language parses it, but it has two costs here.

First, JavaScript parses every JSON number as a double, which holds every whole number exactly only up to 2^53 (9,007,199,254,740,992). Our order ID is one past that, so JavaScript reads it back as 9007199254740992, a different order. The usual fix is sending big IDs as strings.

Second, the field names travel with every message, which wastes space at scale.

Both costs come from JSON describing itself in every message. Suppose the two sides agreed on the field list ahead of time and wrote it down once, in a file called a **schema**:

```proto
message CartLine {
  int64  order_id = 1;
  int32  cents    = 2;
  int32  qty      = 3;
  string name     = 4;
}
```

Each field has a name, a type and a number. Now a message needn't repeat the names. It says "field 1 is this value, field 2 is that one", so the message shrinks. A binary format like Protocol Buffers works this way, and the bytes it produces are the **wire format**.

The type also fixes the order ID: `int64` means the value travels as an exact 64-bit integer, so the 2^53 problem never happens on the wire. A JavaScript client still has to decode it into a bigint (JavaScript's arbitrary-size integer type) or a string, because a plain double can't hold it.

The price is that nobody can read the bytes without the schema, so both sides must share it.

The field numbers pay that back. To add a gift message, give it `string gift = 5`. Older readers see a number they don't know and skip it, so nothing breaks. But reusing a number makes old readers misread the new value as the old field; renumbering makes them lose it.

Sharing a schema is why [gRPC](/computing-fundamentals/rest-vs-grpc-vs-graphql) uses this format between internal services, while public APIs mostly stay on JSON.

**Rule of thumb.** Pick the representation for the worst value it must hold: integers wide enough for the largest ID, exact integers or decimals for money, and a stated unit for text length. Whenever a value crosses a boundary, check that both sides read the same bits the same way.
