import { getContent, getModel, modelPathFor, type Locale } from "@/lib/i18n";
import { SITE, CONTACT_EMAIL, REPO } from "@/lib/site";
import * as e from "@/lib/economics";

/**
 * The `.md` mirrors and `/llms.txt` render from the same content modules and
 * the same `lib/economics` derivations as the HTML pages. A crawler, a model
 * and a person therefore cannot be shown different figures — there is no
 * second copy of any number to fall out of date.
 */

const won = (v: number) => `₩${Math.round(v).toLocaleString("en-US")}`;
const pc = (v: number) => `${(v * 100).toFixed(1)}%`;

export function renderMarkdown(locale: Locale): string {
  const t = getModel(locale);
  const ko = locale === "ko";
  const L = ko
    ? {
        model: "운영 모델 (차량 1대 · 월)",
        api: "Tesla Fleet API 요금",
        issued: "발행 DRV 액면가",
        net: "순 보상 원가",
        total: "대당 월 현금 지출",
        share: "현금 지출 중 API 비중",
        breakeven: "손익분기 (대당 · 월)",
        gen: "Genesis 500 월 지출",
        genApi: "API만",
        genTrue: "보상 포함 실제",
        note: "주의",
      }
    : {
        model: "Operating model (per vehicle · month)",
        api: "Tesla Fleet API",
        issued: "DRV issued, face value",
        net: "Net reward cost",
        total: "Cash out per vehicle · month",
        share: "API share of cash out",
        breakeven: "Break-even (per vehicle · month)",
        gen: "Genesis 500 monthly outlay",
        genApi: "API only",
        genTrue: "reward included",
        note: "Note",
      };

  const lines: string[] = [];
  const h = (n: number, s: string) => lines.push(`${"#".repeat(n)} ${s}`, "");
  const p = (s: string) => lines.push(s, "");

  h(1, t.meta.title);
  p(t.meta.description);
  p(`${SITE}${modelPathFor(locale)}`);

  h(2, t.hero.h1);
  p(t.hero.sub);
  p(t.hero.stats.map((s) => `- **${s.value}** — ${s.label}`).join("\n"));

  h(2, t.how.h2);
  p(t.how.lede);
  p(t.how.steps.map((s) => `${s.k}. **${s.t}** — ${s.d}`).join("\n"));

  h(2, t.telemetry.h2);
  p(t.telemetry.lede);
  p(t.telemetry.signals.map((s) => `- \`${s.code}\` **${s.t}** — ${s.d}`).join("\n"));
  p(`${t.telemetry.notTitle}: ${t.telemetry.not.join(" · ")}`);

  h(2, t.tokens.h2);
  p(t.tokens.lede);
  for (const d of [t.tokens.drv, t.tokens.tslm]) {
    h(3, `${d.name} — ${d.full}`);
    p(d.d);
    p(d.rows.map((r) => `- ${r.k}: ${r.v}`).join("\n"));
  }

  h(2, t.sinks.h2);
  p(t.sinks.lede);
  p(
    (["cash", "burn", "defer"] as const)
      .map((k) => `- **${t.sinks.kinds[k].t}** — ${t.sinks.kinds[k].d}`)
      .join("\n"),
  );

  h(2, t.economics.h2);
  p(t.economics.lede);
  h(3, L.model);
  p(
    [
      "| | |",
      "| --- | ---: |",
      `| ${L.api} | ${won(e.apiKrwPerMonth)} |`,
      `| ${L.issued} | ${won(e.rewardKrwPerMonth)} |`,
      `| ${L.net} | ${won(e.netRewardKrwPerMonth)} |`,
      `| **${L.total}** | **${won(e.cashCostPerVehicleMonth)}** |`,
      `| ${L.share} | ${pc(e.apiShareOfCashCost)} |`,
      `| ${L.breakeven} | ${won(e.breakevenKrwPerVehicleMonth)} |`,
    ].join("\n"),
  );
  p(t.economics.breakevenNote);
  h(3, L.gen);
  p(
    [
      `- ${L.genApi}: ${won(e.genesisApiKrwPerMonth)}`,
      `- ${L.genTrue}: ${won(e.genesisTotalKrwPerMonth)}`,
    ].join("\n"),
  );
  p(t.economics.genesisNote);

  h(2, t.revenue.h2);
  p(t.revenue.lede);
  p(
    Object.values(t.revenue.lines)
      .map((l) => `- **${l.t}** (${l.stage}, ${t.revenue.notContracted}) — ${l.d}`)
      .join("\n"),
  );

  h(2, t.roadmap.h2);
  p(t.roadmap.lede);
  p(
    Object.values(t.roadmap.phases)
      .map((ph) => `- **${ph.t}** — ${ph.d}`)
      .join("\n"),
  );

  h(2, t.integrity.h2);
  p(t.integrity.lede);
  p(t.integrity.checks.map((c) => `- **${c.t}** — ${c.d}`).join("\n"));
  p(`**${t.integrity.privacyTitle}.** ${t.integrity.privacyNote}`);

  h(2, t.cta.h2);
  p(t.cta.body);
  p(t.cta.note);

  h(2, L.note);
  p(`> ${t.footer.disclaimerTrademark}`);
  p(`> ${t.footer.disclaimerFinancial}`);
  p(`${t.footer.contactLabel}: ${CONTACT_EMAIL} · ${REPO}`);
  p(`${t.footer.snapshot}: ${e.capturedAt}`);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function renderLlmsTxt(): string {
  const ko = getContent("ko");
  const en = getContent("en");

  return [
    "# teslam.io",
    "",
    `> ${en.meta.description}`,
    "",
    "An independent community project. Not affiliated with or endorsed by",
    "Tesla, Inc. No token has been issued; every figure below is the output of",
    "an operating model, not a result and not an offer.",
    "",
    "The service has not launched. Posts, rankings and balances shown on the",
    "front page are sample content illustrating a populated board — they are",
    "not real activity and must not be reported as such.",
    "",
    "## Pages",
    "",
    `- [Korean (canonical)](${SITE}/): ${ko.meta.description}`,
    `- [English](${SITE}/en): ${en.meta.description}`,
    `- [Operating model](${SITE}/model): the cost structure behind the rewards`,
    "",
    "## Machine-readable",
    "",
    `- [${SITE}/model.md](${SITE}/model.md) — the operating model as Markdown`,
    `- [${SITE}/en/model.md](${SITE}/en/model.md) — same, in English`,
    `- [${SITE}/model.json](${SITE}/model.json) — the raw model inputs`,
    "",
    "## The model, in four numbers",
    "",
    `- Tesla Fleet API, per vehicle per month: ${won(e.apiKrwPerMonth)}`,
    `- DRV issued at face value, per vehicle per month: ${won(e.rewardKrwPerMonth)}`,
    `- Actual cash out, per vehicle per month: ${won(e.cashCostPerVehicleMonth)}`,
    `- API fees as a share of that: ${pc(e.apiShareOfCashCost)}`,
    "",
    "The API bill is the smallest line. The reward is the constraint.",
    "",
    `Contact: ${CONTACT_EMAIL}`,
    `Source: ${REPO}`,
    `Model captured: ${e.capturedAt}`,
    "",
  ].join("\n");
}
