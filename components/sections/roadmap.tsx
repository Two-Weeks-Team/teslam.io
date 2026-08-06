import { Section } from "@/components/sections/section";
import { getModel, type Locale } from "@/lib/i18n";
import { n } from "@/lib/format";
import roadmapData from "@/data/roadmap.json";

type Phases = ReturnType<typeof getModel>["roadmap"]["phases"];

export function Roadmap({ locale }: { locale: Locale }) {
  const t = getModel(locale).roadmap;
  const phases = t.phases as Phases;

  return (
    <Section id="roadmap" eyebrow={t.eyebrow} h2={t.h2} lede={t.lede}>
      <ol className="phases">
        {roadmapData.phases.map((p) => {
          const c = phases[p.id as keyof Phases];
          const next = p.status === "next";
          return (
            <li className={next ? "phase phase--next" : "phase"} key={p.id}>
              <div className="phase__top">
                <span>{p.months}</span>
                <span className="phase__st">
                  {next ? t.statusNext : t.statusPlanned}
                  {p.seats
                    ? ` · ${n(locale, p.seats)} ${t.seatsLabel}`
                    : ""}
                </span>
              </div>
              <h3 className="phase__t">{c.t}</h3>
              <p className="phase__d">{c.d}</p>
              <div className="phase__b">
                {c.bullets.map((b) => (
                  <p className="phase__bi" key={b}>
                    {b}
                  </p>
                ))}
              </div>
              <p className="phase__gate">{p.gate}</p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
