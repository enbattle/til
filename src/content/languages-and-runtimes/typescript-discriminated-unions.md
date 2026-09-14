---
title: TypeScript Discriminated Unions
summary: How to model "one of several distinct shapes" so the compiler checks every case for you.
date: 2026-09-13
---

A lot of real-world data comes in a few distinct shapes rather than one
fixed shape: a network request is either still loading, succeeded, or
failed; a shape is either a circle or a square. TypeScript's
**discriminated unions** are the standard way to model that "one of
these, but which one varies" situation so that the compiler — not just
your own memory — keeps every case handled correctly.

## Starting with a plain union

A basic union type says a value can be one of several types:

```ts
type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number };
```

Each branch is an object with its own fields, plus one field, `kind`,
that every branch shares but gives a different literal value. That shared
field is the **discriminant** — the tag that says which branch you're
actually looking at.

## Why the discriminant matters

Without a shared tag, if you have a value that could be several different
object shapes, TypeScript can't safely narrow it — it doesn't know which
shape's fields are actually present. With the `kind` field in place, a
plain `if` or `switch` on it is enough for TypeScript to know exactly
which shape you're working with inside each branch:

```ts
function area(shape: Shape): number {
  if (shape.kind === 'circle') {
    // TypeScript knows `shape` is the circle branch here —
    // `shape.radius` is valid, `shape.side` would be a compile error.
    return Math.PI * shape.radius ** 2;
  }
  // The only branch left is 'square'.
  return shape.side ** 2;
}
```

This is called **narrowing**: TypeScript starts with the full union type
and narrows it down to just one branch based on a check you've already
written, without needing a type assertion or a cast anywhere.

## Exhaustiveness: catching a forgotten case

The real payoff shows up when a third shape gets added later — say,
`{ kind: 'rectangle'; width: number; height: number }` — and someone
forgets to update the `area` function. A `switch` statement with a
default case that assigns the remaining value to `never` turns that
mistake into a compile error instead of a silent bug:

```ts
function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'square':
      return shape.side ** 2;
    default: {
      // If every case above were handled, `shape` would be narrowed to
      // `never` here. If a new shape is added to the union and this
      // switch isn't updated, `shape` is NOT `never` — and assigning it
      // to a `never`-typed variable is a compile error, right where the
      // missing case actually is.
      const exhaustive: never = shape;
      throw new Error(`Unhandled shape: ${JSON.stringify(exhaustive)}`);
    }
  }
}
```

This pattern is sometimes called an "exhaustiveness check." It converts
"did I forget a case?" from a question you have to remember to ask into
one the compiler answers for you, every time the union changes.

## Where this shows up in practice

Discriminated unions are the standard way to model states that are
mutually exclusive rather than a pile of optional fields:

```ts
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };
```

Compare that to modeling the same thing with a single object full of
optional fields (`data?`, `error?`, `isLoading?`) — with optional fields,
nothing stops `isLoading` and `error` from both being set at once, an
invalid combination the types don't rule out. A discriminated union makes
invalid combinations impossible to represent in the first place, which is
a more reliable guarantee than remembering to check for them at runtime.
