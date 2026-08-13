"use client";

import { useState } from "react";
import {
  KM_BANDS,
  MODELS,
  REGIONS,
  TRIMS,
  type Model,
} from "@/lib/genesis";
import { getGenesis, legalPathFor, type Locale } from "@/lib/i18n";
import { API_ORIGIN } from "@/lib/site";

/**
 * The registration form.
 *
 * Consent is two separate required checkboxes, not one combined tick and not a
 * pre-checked box — Korean law treats those as consent not freely given, and
 * more to the point, a person should be able to say yes to the terms and no to
 * the mailing list without hunting for the difference.
 *
 * Validation mirrors the Worker's rather than duplicating rules: the vocabulary
 * comes from the same `lib/genesis` module both sides import, so a select can
 * never offer a region the API would reject.
 */

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "pending" }
  | { kind: "already" }
  | { kind: "error"; message: string; fields?: string[] };

export function GenesisForm({ locale }: { locale: Locale }) {
  const t = getGenesis(locale);
  const [model, setModel] = useState<Model>(MODELS[0]);
  const [state, setState] = useState<State>({ kind: "idle" });

  const invalid = (name: string) =>
    state.kind === "error" && state.fields?.includes(name);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending" });

    const data = new FormData(e.currentTarget);
    const body = {
      email: String(data.get("email") ?? ""),
      model: String(data.get("model") ?? ""),
      trim: String(data.get("trim") ?? ""),
      region: String(data.get("region") ?? ""),
      kmBand: String(data.get("kmBand") ?? ""),
      consentTerms: data.get("consentTerms") === "on",
      consentPrivacy: data.get("consentPrivacy") === "on",
      consentMarketing: data.get("consentMarketing") === "on",
      locale,
    };

    try {
      const res = await fetch(`${API_ORIGIN}/v1/genesis/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = (await res.json()) as {
        status?: string;
        error?: string;
        fields?: string[];
      };

      if (res.status === 429) {
        setState({ kind: "error", message: t.errors.rateLimited });
      } else if (res.status === 400) {
        setState({ kind: "error", message: t.errors.invalid, fields: out.fields });
      } else if (out.status === "already_registered") {
        setState({ kind: "already" });
      } else if (out.status === "pending") {
        setState({ kind: "pending" });
      } else {
        setState({ kind: "error", message: t.errors.network });
      }
    } catch {
      setState({ kind: "error", message: t.errors.network });
    }
  }

  if (state.kind === "pending") {
    return (
      <div className="gx__state" role="status">
        <h2>{t.pending.title}</h2>
        <p>{t.pending.body}</p>
        <p className="gx__disc">{t.pending.resend}</p>
      </div>
    );
  }

  if (state.kind === "already") {
    return (
      <div className="gx__state" role="status">
        <h2>{t.already.title}</h2>
        <p>{t.already.body}</p>
      </div>
    );
  }

  return (
    <form className="gf" onSubmit={onSubmit} noValidate>
      <div className="gf__field">
        <label className="gf__label" htmlFor="email">
          {t.form.emailLabel}
        </label>
        <input
          className="gf__input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={invalid("email") || undefined}
          aria-describedby="email-hint"
        />
        <p className="gf__hint" id="email-hint">
          {t.form.emailHint}
        </p>
      </div>

      <div className="gf__row">
        <div className="gf__field">
          <label className="gf__label" htmlFor="model">
            {t.form.modelLabel}
          </label>
          <select
            className="gf__select"
            id="model"
            name="model"
            value={model}
            onChange={(e) => setModel(e.target.value as Model)}
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="gf__field">
          <label className="gf__label" htmlFor="trim">
            {t.form.trimLabel}
          </label>
          <select
            className="gf__select"
            id="trim"
            name="trim"
            aria-invalid={invalid("trim") || undefined}
          >
            {TRIMS[model].map((tr) => (
              <option key={tr} value={tr}>
                {tr}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="gf__row">
        <div className="gf__field">
          <label className="gf__label" htmlFor="region">
            {t.form.regionLabel}
          </label>
          <select
            className="gf__select"
            id="region"
            name="region"
            defaultValue=""
            required
            aria-invalid={invalid("region") || undefined}
          >
            <option value="" disabled>
              {t.form.choose}
            </option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {locale === "ko" ? r.ko : r.en}
              </option>
            ))}
          </select>
        </div>

        <div className="gf__field">
          <label className="gf__label" htmlFor="kmBand">
            {t.form.kmLabel}
          </label>
          <select
            className="gf__select"
            id="kmBand"
            name="kmBand"
            defaultValue=""
            required
            aria-invalid={invalid("kmBand") || undefined}
            aria-describedby="km-hint"
          >
            <option value="" disabled>
              {t.form.choose}
            </option>
            {KM_BANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {locale === "ko" ? b.ko : b.en}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="gf__hint" id="km-hint">
        {t.form.kmHint}
      </p>

      <div className="gf__checks">
        <label className="gf__check">
          <input type="checkbox" name="consentTerms" required />
          <span>
            <a href={legalPathFor(locale, "terms")}>{t.form.consentTerms}</a>
          </span>
        </label>
        <label className="gf__check">
          <input type="checkbox" name="consentPrivacy" required />
          <span>
            <a href={legalPathFor(locale, "privacy")}>{t.form.consentPrivacy}</a>
          </span>
        </label>
        <label className="gf__check">
          <input type="checkbox" name="consentMarketing" />
          <span>
            {t.form.consentMarketing}
            <br />
            <span className="gf__hint">{t.form.consentMarketingHint}</span>
          </span>
        </label>
      </div>

      {state.kind === "error" ? (
        <p className="gf__err" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        className="gf__submit"
        type="submit"
        disabled={state.kind === "sending"}
      >
        {state.kind === "sending" ? t.form.submitting : t.form.submit}
      </button>
    </form>
  );
}
