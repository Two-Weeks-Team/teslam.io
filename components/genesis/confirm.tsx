"use client";

import { useEffect, useState } from "react";
import { SeatCluster } from "@/components/genesis/seat-cluster";
import { REGIONS } from "@/lib/genesis";
import { genesisPathFor, getGenesis, pathFor, type Locale } from "@/lib/i18n";
import { API_ORIGIN } from "@/lib/site";

/**
 * The landing page for a confirmation link.
 *
 * The token is spent here rather than in the email client, which matters
 * because scanners follow links in mail. If the API burned tokens on GET from
 * anywhere, a corporate mail filter could confirm someone's seat before they
 * had read the message — so the request is made from the page the person
 * actually opened, and the result is shown to them.
 */

type Placement = { kind: "seat" | "waitlist"; number: number; region: string; model: string };

type State =
  | { kind: "working" }
  | { kind: "done"; placement: Placement }
  | { kind: "failed" }
  | { kind: "no-token" };

export function GenesisConfirm({ locale }: { locale: Locale }) {
  const t = getGenesis(locale).confirm;
  const [state, setState] = useState<State>({ kind: "working" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;

    // Every outcome, including the missing-token one, is settled inside this
    // async function. Setting state synchronously in an effect body would run
    // a second render before the first has committed.
    async function run() {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        if (live) setState({ kind: "no-token" });
        return;
      }

      try {
        const res = await fetch(
          `${API_ORIGIN}/v1/genesis/confirm?token=${encodeURIComponent(token)}`,
        );
        if (!res.ok) throw new Error("rejected");
        const out = (await res.json()) as { placement: Placement };
        if (live) setState({ kind: "done", placement: out.placement });
      } catch {
        if (live) setState({ kind: "failed" });
      }
    }

    void run();

    return () => {
      live = false;
    };
  }, []);

  if (state.kind === "working") {
    return (
      <p className="gx__lede" role="status">
        {t.working}…
      </p>
    );
  }

  if (state.kind === "no-token") {
    return (
      <div className="gx__state gx__state--warn">
        <h2>{t.failedTitle}</h2>
        <p>{t.notToken}</p>
      </div>
    );
  }

  if (state.kind === "failed") {
    return (
      <div className="gx__state gx__state--warn" role="alert">
        <h2>{t.failedTitle}</h2>
        <p>{t.failedBody}</p>
      </div>
    );
  }

  const { placement } = state;
  const seat = placement.kind === "seat";
  const region = REGIONS.find((r) => r.id === placement.region);
  const seatUrl = `${window.location.origin}${genesisPathFor(locale)}/seat/${placement.number}`;

  return (
    <>
      <div className="gx__top">
        <p className="gx__eyebrow">Genesis 500</p>
        <h1 className="gx__h1">{seat ? t.seatTitle : t.waitlistTitle}</h1>
      </div>

      <SeatCluster
        value={placement.number}
        label={seat ? t.seatLabel : t.waitlistLabel}
        suffix={seat ? t.seatOf : undefined}
        tone={seat ? "seat" : "waitlist"}
      />

      {!seat ? <p className="gx__lede">{t.waitlistBody}</p> : null}

      <dl className="gx__plate">
        <dt>{t.nameplate}</dt>
        <dd>
          {placement.model}
          {region ? ` · ${locale === "ko" ? region.ko : region.en}` : ""}
        </dd>
      </dl>

      <div className="gx__actions">
        {seat ? (
          <button
            className="gx__btn"
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(seatUrl).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          >
            {copied ? t.shareCopied : t.share}
          </button>
        ) : null}
        <a className="gx__btn" href={pathFor(locale)}>
          {t.backHome}
        </a>
      </div>
    </>
  );
}
