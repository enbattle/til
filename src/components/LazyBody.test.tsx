import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LazyBody } from './LazyBody';

// Retro: after a `#section` load, `LazyBody` holds the heading in view while
// the page settles (`keepInView`, re-scrolling from a ResizeObserver). It
// already stops at the first wheel, touch, key or pointer press, but a reader
// can also move the page without any of those (a scrollbar drag on some
// platforms, find-in-page, assistive technology, a middle-click autoscroll).
// So it must also stop as soon as the page scrolls somewhere its own last
// scrollIntoView didn't put it.
//
// Interface assumed: the hold reads the page position from `window.scrollY`
// (this test defines `pageYOffset` to match) right after each of its own
// scrollIntoView calls, and listens for `scroll` on the window or the document
// (the event is dispatched on the document and bubbles to the window). A
// `scroll` event whose position matches its own last scroll (the event its
// own scrollIntoView causes) must not stop it.
//
// jsdom has no layout: ResizeObserver is stubbed so the test can fire its
// callback, scrollIntoView is stubbed to move `scrollY` to where "the
// browser" would put the heading, and the heading reports a drifted position
// so a realign would scroll again if the hold were still running.

const OWN_POSITION = 500;
const USER_POSITION = 120;

let scrollY = 0;
let observers: Array<{ callback: ResizeObserverCallback; observer: ResizeObserver }> = [];

class FakeResizeObserver {
  callback: ResizeObserverCallback;
  disconnected = false;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.push({ callback, observer: this as unknown as ResizeObserver });
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

/** Fire every live ResizeObserver callback, as a layout change would. */
function resize() {
  act(() => {
    for (const { callback, observer } of observers) {
      if (!(observer as unknown as FakeResizeObserver).disconnected)
        callback([], observer);
    }
  });
}

function scrollEvent() {
  act(() => {
    document.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
}

const hadScrollIntoView = 'scrollIntoView' in Element.prototype;
const scrollYDescriptor = Object.getOwnPropertyDescriptor(window, 'scrollY');
const pageYOffsetDescriptor = Object.getOwnPropertyDescriptor(window, 'pageYOffset');

beforeEach(() => {
  scrollY = 0;
  observers = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  for (const name of ['scrollY', 'pageYOffset']) {
    Object.defineProperty(window, name, { configurable: true, get: () => scrollY });
  }
  if (!hadScrollIntoView) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: function scrollIntoView() {},
      configurable: true,
      writable: true,
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (scrollYDescriptor) Object.defineProperty(window, 'scrollY', scrollYDescriptor);
  if (pageYOffsetDescriptor)
    Object.defineProperty(window, 'pageYOffset', pageYOffsetDescriptor);
  if (!hadScrollIntoView) {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  }
});

function renderBody() {
  return render(
    <MemoryRouter initialEntries={['/page#target']}>
      <LazyBody load={() => Promise.resolve('body')}>
        {() => (
          <div>
            <p>Text above the heading.</p>
            <h2 id="target">Target</h2>
            <p>Text below the heading.</p>
          </div>
        )}
      </LazyBody>
    </MemoryRouter>,
  );
}

/** Render, wait for the initial hash scroll, and make the heading report that
 * it has drifted from its scroll margin (so a realign would scroll it). */
async function openAtHash(top = 200) {
  const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {
    scrollY = OWN_POSITION;
  });
  renderBody();
  const heading = await screen.findByRole('heading', { name: 'Target' });
  await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
  expect(observers.length).toBeGreaterThan(0);
  vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom: top + 30,
    left: 0,
    right: 100,
    width: 100,
    height: 30,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
  return scroll;
}

// docs/specs/focus-not-obscured.md, criterion 4: the hold's alignment check
// reads the root's computed scroll-padding-top (what the browser's own
// scrollIntoView now leaves above the heading), not the heading's own
// scroll-margin-top, which is gone. The root's padding is stubbed to PADDING
// and the heading's margin to 0.

const PADDING = 80;

/** A computed style reporting `property` (a CSS name) as `value`, by that name
 * and its camelCase form. */
function withStyle(
  style: CSSStyleDeclaration,
  property: string,
  value: string,
): CSSStyleDeclaration {
  const camel = property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return new Proxy(style, {
    get(target, prop) {
      if (prop === camel) return value;
      if (prop === 'getPropertyValue')
        return (name: string) =>
          name === property ? value : target.getPropertyValue(name);
      const real = Reflect.get(target, prop, target) as unknown;
      return typeof real === 'function'
        ? (real as (...args: unknown[]) => unknown).bind(target)
        : real;
    },
  });
}

/** Stubs the root's scroll-padding-top to PADDING and the target heading's
 * scroll-margin-top to 0 (restored by vi.restoreAllMocks in afterEach). */
function stubRootPadding() {
  const realGetComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
    const style = realGetComputedStyle(el, pseudo);
    if (el === document.documentElement)
      return withStyle(style, 'scroll-padding-top', `${PADDING}px`);
    if (el.id === 'target') return withStyle(style, 'scroll-margin-top', '0px');
    return style;
  });
}

describe('LazyBody hash scroll-hold aligns to the root’s scroll padding (focus-not-obscured criterion 4)', () => {
  it('treats the heading as aligned when its top equals the root’s scroll-padding-top, and does not re-scroll', async () => {
    stubRootPadding();
    const scroll = await openAtHash(PADDING);
    resize();
    resize();
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('re-scrolls when the heading has drifted to the top edge, under the sticky strip', async () => {
    stubRootPadding();
    const scroll = await openAtHash(0);
    resize();
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it('re-scrolls when the heading has drifted below the root’s scroll-padding-top', async () => {
    stubRootPadding();
    const scroll = await openAtHash(PADDING + 120);
    resize();
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it('keeps holding after a scroll that leaves the heading at the root’s scroll-padding-top', async () => {
    stubRootPadding();
    const scroll = await openAtHash(PADDING);
    // Scroll anchoring moves the page but leaves the heading aligned: kept.
    scrollY = USER_POSITION;
    scrollEvent();
    // Then the layout shifts the heading off its line: the hold realigns.
    vi.spyOn(
      screen.getByRole('heading', { name: 'Target' }),
      'getBoundingClientRect',
    ).mockReturnValue({
      top: 0,
      bottom: 30,
      left: 0,
      right: 100,
      width: 100,
      height: 30,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    resize();
    expect(scroll).toHaveBeenCalledTimes(2);
  });
});

describe('LazyBody hash scroll-hold stops when the reader scrolls (retro)', () => {
  it('keeps realigning after a scroll event it caused itself (the harness works)', async () => {
    const scroll = await openAtHash();
    // The scroll event from its own scrollIntoView: the position is where it put it.
    scrollEvent();
    resize();
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it('stops realigning once the page scrolls somewhere it did not put it', async () => {
    const scroll = await openAtHash();
    scrollEvent(); // its own
    // The reader scrolls by some means that isn't wheel, touch, key or pointer.
    scrollY = USER_POSITION;
    scrollEvent();
    resize();
    resize();
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('stops even when the reader scrolls before its own scroll event arrives', async () => {
    const scroll = await openAtHash();
    scrollY = USER_POSITION;
    scrollEvent();
    resize();
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});
