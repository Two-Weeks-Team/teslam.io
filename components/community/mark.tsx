import { getContent, type Locale } from "@/lib/i18n";

/**
 * Marks a block as a real figure or as sample content.
 *
 * The banner at the top of the page says which is which, but a banner is read
 * once and the board is scrolled for minutes. Someone who lands on the
 * leaderboard from a shared link never sees the banner at all — so the claim
 * travels with the block it applies to.
 *
 * This matters more now than it did. When everything on the page was invented,
 * one notice covered it honestly. Now that the seat count, the regional split
 * and the watcher count are real measurements sitting beside invented posts,
 * an undifferentiated notice is the misleading option.
 */
export function Mark({
  locale,
  kind,
}: {
  locale: Locale;
  kind: "real" | "sample";
}) {
  const t = getContent(locale).preview;
  return (
    <span className={`mark mark--${kind}`}>
      {kind === "real" ? t.realLabel : t.sampleLabel}
    </span>
  );
}
