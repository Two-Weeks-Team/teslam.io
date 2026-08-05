import type { ReactNode } from "react";

/** The numbered editorial frame every section shares. */
export function Section({
  id,
  eyebrow,
  h2,
  lede,
  children,
}: {
  id: string;
  eyebrow: string;
  h2: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="sec">
      <hr className="rule" />
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="sec__h2">{h2}</h2>
      {lede ? <p className="sec__lede">{lede}</p> : null}
      {children}
    </section>
  );
}
