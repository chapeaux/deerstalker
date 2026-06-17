import type { FileMetric, FullReport } from "./types.ts";
import { GLOSSARY } from "./glossary.ts";

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function changeDir(a: number, b: number, lowerIsBetter = true): string {
  if (a === b) return "same";
  if (a === 0) return "N/A";
  const rawPct = Math.round(((a - b) / a) * 100);
  const less = b < a;
  const improved = lowerIsBetter ? less : !less;
  const label = improved ? "better" : "worse";
  return `${rawPct > 0 ? "" : "+"}${-rawPct}% (${label})`;
}

function mdRow(cells: (string | number)[]): string {
  return "| " +
    cells.map((c) => typeof c === "number" && c > 999 ? fmtNum(c) : String(c))
      .join(" | ") +
    " |";
}

function hotspotTable(
  label: string,
  files: FileMetric[],
  basePath: string,
): string {
  const lines = [
    `### ${label}`,
    "",
    "| File | Code | CC |",
    "|---|---:|---:|",
  ];
  for (const f of files.slice(0, 10)) {
    const short = f.file.replace(basePath, "").replace(/^\//, "");
    lines.push(`| ${short} | ${fmtNum(f.code)} | ${fmtNum(f.complexity)} |`);
  }
  return lines.join("\n");
}

export function generateMdReport(report: FullReport): string {
  const d = report;
  const la = d.folderA.label;
  const lb = d.folderB.label;

  const sections: string[] = [];

  sections.push(`# Codebase Comparison`);
  sections.push("");
  sections.push(
    `**${la}** vs **${lb}** — Generated ${new Date().toLocaleString()}`,
  );
  sections.push("");

  sections.push("## Summary");
  sections.push("");
  sections.push(`| Metric | ${la} | ${lb} | Change |`);
  sections.push("|---|---:|---:|---|");
  for (const r of d.comparison) {
    sections.push(mdRow([r.label, r.a, r.b, r.reduction]));
  }
  sections.push("");

  sections.push("## Code Size");
  sections.push("");
  sections.push(`| Metric | ${la} | ${lb} | Change |`);
  sections.push("|---|---:|---:|---|");
  sections.push(
    mdRow([
      "Source files",
      d.folderA.totals.files,
      d.folderB.totals.files,
      changeDir(d.folderA.totals.files, d.folderB.totals.files),
    ]),
  );
  sections.push(
    mdRow([
      "Lines of code",
      d.folderA.totals.code,
      d.folderB.totals.code,
      changeDir(d.folderA.totals.code, d.folderB.totals.code),
    ]),
  );
  sections.push(
    mdRow([
      "Comments",
      d.folderA.totals.comments,
      d.folderB.totals.comments,
      changeDir(d.folderA.totals.comments, d.folderB.totals.comments),
    ]),
  );
  sections.push("");

  sections.push("## Complexity");
  sections.push("");
  sections.push(`| Metric | ${la} | ${lb} | Change |`);
  sections.push("|---|---:|---:|---|");
  sections.push(
    mdRow([
      "Cyclomatic complexity",
      d.folderA.totals.complexity,
      d.folderB.totals.complexity,
      changeDir(d.folderA.totals.complexity, d.folderB.totals.complexity),
    ]),
  );
  sections.push(
    mdRow([
      "Cognitive complexity",
      d.folderA.ai.cognitiveComplexity,
      d.folderB.ai.cognitiveComplexity,
      changeDir(
        d.folderA.ai.cognitiveComplexity,
        d.folderB.ai.cognitiveComplexity,
      ),
    ]),
  );
  sections.push(
    mdRow([
      "Max nesting depth",
      d.folderA.ai.details.maxNestingDepth,
      d.folderB.ai.details.maxNestingDepth,
      changeDir(
        d.folderA.ai.details.maxNestingDepth,
        d.folderB.ai.details.maxNestingDepth,
      ),
    ]),
  );
  sections.push(
    mdRow([
      "Avg function length",
      d.folderA.ai.details.avgFunctionLength,
      d.folderB.ai.details.avgFunctionLength,
      changeDir(
        d.folderA.ai.details.avgFunctionLength,
        d.folderB.ai.details.avgFunctionLength,
      ),
    ]),
  );
  sections.push(
    mdRow([
      "Conditional density (/100 LOC)",
      d.folderA.ai.details.conditionalDensity,
      d.folderB.ai.details.conditionalDensity,
      changeDir(
        d.folderA.ai.details.conditionalDensity,
        d.folderB.ai.details.conditionalDensity,
      ),
    ]),
  );
  sections.push(
    mdRow([
      "Conditionals per function",
      d.folderA.ai.details.condDensityPerFunction,
      d.folderB.ai.details.condDensityPerFunction,
      changeDir(
        d.folderA.ai.details.condDensityPerFunction,
        d.folderB.ai.details.condDensityPerFunction,
      ),
    ]),
  );
  sections.push("");

  sections.push("## Dependencies & Config");
  sections.push("");
  sections.push(`| Metric | ${la} | ${lb} | Change |`);
  sections.push("|---|---:|---:|---|");
  sections.push(
    mdRow([
      "Dependencies",
      d.folderA.dependencies.total,
      d.folderB.dependencies.total,
      changeDir(d.folderA.dependencies.total, d.folderB.dependencies.total),
    ]),
  );
  sections.push(
    mdRow([
      "Production deps",
      d.folderA.dependencies.production,
      d.folderB.dependencies.production,
      changeDir(
        d.folderA.dependencies.production,
        d.folderB.dependencies.production,
      ),
    ]),
  );
  sections.push(
    mdRow([
      "Dev deps",
      d.folderA.dependencies.development,
      d.folderB.dependencies.development,
      changeDir(
        d.folderA.dependencies.development,
        d.folderB.dependencies.development,
      ),
    ]),
  );
  sections.push(
    mdRow([
      "Config files",
      d.folderA.configFiles,
      d.folderB.configFiles,
      changeDir(d.folderA.configFiles, d.folderB.configFiles),
    ]),
  );
  sections.push(
    mdRow([
      "Build/task scripts",
      d.folderA.scripts,
      d.folderB.scripts,
      changeDir(d.folderA.scripts, d.folderB.scripts),
    ]),
  );
  sections.push("");

  sections.push("## AI Friendliness");
  sections.push("");
  sections.push(`| Metric | ${la} | ${lb} | Change |`);
  sections.push("|---|---:|---:|---|");
  sections.push(
    mdRow([
      "CodeHealth score (0-100)",
      d.folderA.ai.codeHealth,
      d.folderB.ai.codeHealth,
      changeDir(d.folderA.ai.codeHealth, d.folderB.ai.codeHealth, false),
    ]),
  );
  sections.push(
    mdRow([
      "LLM Clarity (0-100)",
      d.folderA.ai.clarity,
      d.folderB.ai.clarity,
      changeDir(d.folderA.ai.clarity, d.folderB.ai.clarity, false),
    ]),
  );
  sections.push(
    mdRow([
      "Naming score (0-100)",
      d.folderA.ai.details.namingScore,
      d.folderB.ai.details.namingScore,
      changeDir(
        d.folderA.ai.details.namingScore,
        d.folderB.ai.details.namingScore,
        false,
      ),
    ]),
  );
  sections.push(
    mdRow([
      "Comment density (%)",
      d.folderA.ai.details.commentDensity,
      d.folderB.ai.details.commentDensity,
      changeDir(
        d.folderA.ai.details.commentDensity,
        d.folderB.ai.details.commentDensity,
        false,
      ),
    ]),
  );
  sections.push("");

  sections.push("## Token Economy");
  sections.push("");
  sections.push(`| Metric | ${la} | ${lb} | Change |`);
  sections.push("|---|---:|---:|---|");
  sections.push(
    mdRow([
      "LLM context tokens",
      d.folderA.tokens.estimatedTokens,
      d.folderB.tokens.estimatedTokens,
      changeDir(
        d.folderA.tokens.estimatedTokens,
        d.folderB.tokens.estimatedTokens,
      ),
    ]),
  );
  sections.push(
    mdRow([
      "Tokens per file",
      d.folderA.tokens.tokensPerFile,
      d.folderB.tokens.tokensPerFile,
      changeDir(d.folderA.tokens.tokensPerFile, d.folderB.tokens.tokensPerFile),
    ]),
  );
  sections.push(
    mdRow([
      "Direct tokens",
      d.folderA.ai.tokenFanOut.direct,
      d.folderB.ai.tokenFanOut.direct,
      changeDir(
        d.folderA.ai.tokenFanOut.direct,
        d.folderB.ai.tokenFanOut.direct,
      ),
    ]),
  );
  sections.push(
    mdRow([
      "Fan-out tokens",
      d.folderA.ai.tokenFanOut.fanOut,
      d.folderB.ai.tokenFanOut.fanOut,
      changeDir(
        d.folderA.ai.tokenFanOut.fanOut,
        d.folderB.ai.tokenFanOut.fanOut,
      ),
    ]),
  );
  sections.push(
    mdRow([
      "Context fan-out total",
      d.folderA.ai.tokenFanOut.total,
      d.folderB.ai.tokenFanOut.total,
      changeDir(
        d.folderA.ai.tokenFanOut.total,
        d.folderB.ai.tokenFanOut.total,
      ),
    ]),
  );
  sections.push(
    mdRow([
      "Fan-out files",
      d.folderA.ai.tokenFanOut.fanOutFiles,
      d.folderB.ai.tokenFanOut.fanOutFiles,
      changeDir(
        d.folderA.ai.tokenFanOut.fanOutFiles,
        d.folderB.ai.tokenFanOut.fanOutFiles,
      ),
    ]),
  );
  sections.push("");

  sections.push("## COCOMO Estimates");
  sections.push("");
  sections.push(`| Metric | ${la} | ${lb} | Change |`);
  sections.push("|---|---:|---:|---|");
  sections.push(
    mdRow([
      "Estimated cost ($)",
      d.folderA.cocomo.estimatedCost,
      d.folderB.cocomo.estimatedCost,
      changeDir(
        d.folderA.cocomo.estimatedCost,
        d.folderB.cocomo.estimatedCost,
      ),
    ]),
  );
  sections.push(
    mdRow([
      "Schedule (months)",
      d.folderA.cocomo.scheduleMonths,
      d.folderB.cocomo.scheduleMonths,
      changeDir(
        d.folderA.cocomo.scheduleMonths,
        d.folderB.cocomo.scheduleMonths,
      ),
    ]),
  );
  sections.push("");

  if (d.folderA.beret && d.folderB.beret) {
    sections.push("## Structural Analysis (Beret)");
    sections.push("");
    sections.push(`| Metric | ${la} | ${lb} | Change |`);
    sections.push("|---|---:|---:|---|");
    sections.push(
      mdRow([
        "Functions",
        d.folderA.beret.architecture.counts.functions,
        d.folderB.beret.architecture.counts.functions,
        changeDir(
          d.folderA.beret.architecture.counts.functions,
          d.folderB.beret.architecture.counts.functions,
        ),
      ]),
    );
    sections.push(
      mdRow([
        "Classes",
        d.folderA.beret.architecture.counts.classes,
        d.folderB.beret.architecture.counts.classes,
        changeDir(
          d.folderA.beret.architecture.counts.classes,
          d.folderB.beret.architecture.counts.classes,
        ),
      ]),
    );
    sections.push(
      mdRow([
        "Test functions",
        d.folderA.beret.testing.test_functions,
        d.folderB.beret.testing.test_functions,
        changeDir(
          d.folderA.beret.testing.test_functions,
          d.folderB.beret.testing.test_functions,
        ),
      ]),
    );
    sections.push(
      mdRow([
        "Test ratio (%)",
        d.folderA.beret.testing.test_ratio_percent,
        d.folderB.beret.testing.test_ratio_percent,
        changeDir(
          d.folderA.beret.testing.test_ratio_percent,
          d.folderB.beret.testing.test_ratio_percent,
          false,
        ),
      ]),
    );
    sections.push("");
    sections.push(
      `**${la} layers:** ${
        d.folderA.beret.architecture.layers.join(", ") || "none detected"
      }`,
    );
    sections.push(
      `**${lb} layers:** ${
        d.folderB.beret.architecture.layers.join(", ") || "none detected"
      }`,
    );
    sections.push("");
  }

  sections.push("## Language Breakdown");
  sections.push("");
  const allLangs = new Set([
    ...Object.keys(d.folderA.scc),
    ...Object.keys(d.folderB.scc),
  ]);
  sections.push(`| Language | ${la} (files / code) | ${lb} (files / code) |`);
  sections.push("|---|---|---|");
  for (const lang of allLangs) {
    const a = d.folderA.scc[lang];
    const b = d.folderB.scc[lang];
    const aStr = a ? `${a.files} / ${fmtNum(a.code)}` : "—";
    const bStr = b ? `${b.files} / ${fmtNum(b.code)}` : "—";
    sections.push(`| ${lang} | ${aStr} | ${bStr} |`);
  }
  sections.push("");

  sections.push("## Complexity Hotspots");
  sections.push("");
  sections.push("Top 10 files by cyclomatic complexity");
  sections.push("");
  sections.push(hotspotTable(la, d.folderA.topFiles, d.folderA.path));
  sections.push("");
  sections.push(hotspotTable(lb, d.folderB.topFiles, d.folderB.path));
  sections.push("");

  sections.push("---");
  sections.push("");
  sections.push("## Glossary");
  sections.push("");
  sections.push(
    "How each metric is calculated and what it means in practice.",
  );
  sections.push("");
  for (const entry of GLOSSARY) {
    sections.push(`### ${entry.name}`);
    sections.push("");
    sections.push(entry.short);
    sections.push("");
    sections.push(`**How it's calculated:** ${entry.calc}`);
    sections.push("");
    sections.push(`**What it means:** ${entry.meaning}`);
    sections.push("");
  }

  return sections.join("\n");
}
