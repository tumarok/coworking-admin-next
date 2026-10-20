/** Id of the element the skip link jumps to. */
export const MAIN_CONTENT_ID = 'main-content';

/** First stop for the keyboard: lets a visitor jump over the navigation. Visible only on focus. */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
    >
      Skip to content
    </a>
  );
}
