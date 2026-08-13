"use client";

import { useLive } from "@/components/community/live-provider";
import { getContent, type Locale } from "@/lib/i18n";

/**
 * The banner that says which parts of this page are real.
 *
 * It has to be a client component for one reason: while the rehearsed run is
 * playing, its usual sentence — that the seat count, the regional split and the
 * watcher count are real measurements — is false. Leaving a server-rendered
 * claim in place above a board full of invented numbers would be precisely the
 * failure this banner exists to prevent, and it is the kind that survives
 * review because the sentence was true when it was written.
 */
export function PreviewBanner({ locale }: { locale: Locale }) {
  const { demo } = useLive();
  const t = getContent(locale).preview;

  if (demo.playing) {
    return (
      <p className="pv pv--demo" role="status">
        <span className="pv__tag">{t.demoTag}</span>
        <span className="pv__b">{t.demoBody}</span>
      </p>
    );
  }

  return (
    <p className="pv">
      <span className="pv__tag">{t.tag}</span>
      <span className="pv__b">{t.body}</span>
    </p>
  );
}
