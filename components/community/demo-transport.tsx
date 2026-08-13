"use client";

import { useEffect } from "react";
import { useLive } from "@/components/community/live-provider";
import { getContent, type Locale } from "@/lib/i18n";

/**
 * Play and stop for the rehearsed run.
 *
 * Modelled on the data simulators — Gapminder, Flightradar24's playback — and
 * deliberately not on the way a product site handles a hero video. A hero video
 * is ambient and hides its controls; this overwrites every number on the board
 * with an invented one, so the control is visible, always reachable, and the
 * playback never begins on its own.
 *
 * That last part is both the accessible answer (WCAG 2.2.2 wants motion that
 * starts by itself to be stoppable, and starting on demand sidesteps the
 * problem entirely) and the honest one: nobody sees a fabricated count here
 * without having asked for it.
 *
 * The segments are the phases, not a decorative progress bar — the script
 * accelerates at each boundary, and showing the boundaries is what makes the
 * acceleration read as intent.
 */
export function DemoTransport({ locale }: { locale: Locale }) {
  const { demo } = useLive();
  const t = getContent(locale).demo;

  // Space toggles playback, which is the convention every transport control on
  // the web already trained people into.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = document.activeElement;
      if (el instanceof HTMLElement && el.dataset.demoToggle !== "1") return;
      e.preventDefault();
      if (demo.playing) demo.stop();
      else demo.start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demo]);

  return (
    <div className={demo.playing ? "dt dt--on" : "dt"}>
      <button
        className="dt__btn"
        type="button"
        data-demo-toggle="1"
        onClick={() => (demo.playing ? demo.stop() : demo.start())}
        aria-label={demo.playing ? t.stop : t.play}
      >
        <span className="dt__icon" aria-hidden="true">
          {demo.playing ? (
            <svg viewBox="0 0 12 12" width="12" height="12">
              <rect x="2" y="2" width="3" height="8" />
              <rect x="7" y="2" width="3" height="8" />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" width="12" height="12">
              <path d="M3 2 L10 6 L3 10 Z" />
            </svg>
          )}
        </span>
        <span className="dt__label">{demo.playing ? t.stop : t.play}</span>
      </button>

      <div className="dt__track" aria-hidden="true">
        {Array.from({ length: demo.phases }, (_, i) => {
          const state =
            !demo.playing || i > demo.phase
              ? "is-idle"
              : i < demo.phase
                ? "is-done"
                : "is-live";
          return (
            <span className={`dt__seg ${state}`} key={i}>
              <span
                className="dt__fill"
                style={
                  i === demo.phase && demo.playing
                    ? { transform: `scaleX(${demo.phaseProgress})` }
                    : undefined
                }
              />
            </span>
          );
        })}
      </div>

      {/*
        The label the whole feature turns on.

        It stays up for the entire run, in the place the eye returns to, rather
        than flashing once at the start — a visitor who arrives mid-playback
        from a scroll or a shared screen has to be able to tell.
      */}
      {demo.playing ? (
        <p className="dt__flag" role="status">
          {t.flag}
        </p>
      ) : (
        <p className="dt__hint">{t.hint}</p>
      )}
    </div>
  );
}
