import sizes from 'virtual:diagram-sizes';
import { useTheme } from '@/contexts/useTheme';
import { useSideScroll } from '@/hooks/useSideScroll';
import { diagramName } from '@/lib/diagram-refs.mjs';

/**
 * The smallest scale a diagram is shown at before it scrolls sideways instead
 * of shrinking further. d2 sets labels at 16px, so 0.75 keeps them at about
 * 12 CSS px: an 811px-wide diagram needs 608px, which the ~720px desktop
 * column has (no scrolling there) and a 375px phone doesn't.
 */
const READABLE_SCALE = 0.75;

/**
 * A build-time D2 diagram written in markdown as
 * `![alt](/diagrams/<case>/<name>.svg)`. `npm run diagrams` renders each
 * source twice, `<name>.light.svg` and `<name>.dark.svg`, from the site's own
 * color tokens, so this picks the file for the current theme instead of
 * recoloring anything at runtime. It's a plain `<img>` (an SVG loaded this way
 * can't run script), sized from the render manifest so the page doesn't shift
 * when it loads, and wrapped in a link to the full-size file.
 *
 * It scales down to fit the content column, but not below `READABLE_SCALE`:
 * past that (a phone) it keeps a readable size inside its own horizontally
 * scrolling box, so the page itself never scrolls sideways. Only while the box
 * actually overflows is it a focusable, labelled region (`useSideScroll`, shared
 * with markdown tables), so a keyboard user can scroll it with the arrow keys;
 * on a wide screen it adds no tab stop.
 *
 * The alt text is spoken once: the link's name is "Open diagram full size:
 * <alt>" (its `aria-label` replaces the img's name inside it), and the region
 * is only "Diagram, scrolls sideways". It's built from phrasing elements
 * (`span` with block display, `a`, `img`), so it stays valid HTML wherever
 * markdown puts it; `MarkdownRenderer` also drops the `<p>` around a diagram
 * written on its own line.
 */
export function Diagram({ src, alt }: { src: string; alt: string }) {
  const { resolved } = useTheme();
  const name = diagramName(src);
  // Read at render time, not module load, so the GitHub Pages base (`/til/`)
  // applies and tests can stub it.
  const file = `${import.meta.env.BASE_URL}diagrams/${name}.${resolved}.svg`;
  const size = sizes[name];
  const minWidth = size ? Math.round(size.width * READABLE_SCALE) : undefined;

  const box = useSideScroll<HTMLSpanElement>('Diagram, scrolls sideways', file);

  return (
    <span {...box}>
      <a
        href={file}
        target="_blank"
        rel="noreferrer"
        aria-label={alt ? `Open diagram full size: ${alt}` : 'Open diagram full size'}
        className="block no-underline"
      >
        <img
          src={file}
          alt={alt}
          loading="lazy"
          width={size?.width}
          height={size?.height}
          style={minWidth ? { minWidth } : undefined}
          className="mx-auto h-auto max-w-full"
        />
      </a>
    </span>
  );
}
