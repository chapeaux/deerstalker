import type { FileMetric, FolderReport, FullReport } from "./types.ts";
import { getMetricEntry } from "./glossary.ts";

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function pct(a: number, b: number): string {
  if (a === 0) return "0%";
  return `${Math.round(((a - b) / a) * 100)}%`;
}

function diffBar(
  valA: number,
  valB: number,
  lowerIsBetter = true,
): string {
  if (valA === 0 && valB === 0) return "";
  const pctChange = valA === 0
    ? (valB > 0 ? -100 : 0)
    : Math.round(((valA - valB) / valA) * 100);
  const numericallyLess = valB < valA;
  const improved = lowerIsBetter ? numericallyLess : !numericallyLess;
  const same = valA === valB;
  const absPct = Math.abs(pctChange);
  const color = same
    ? "#555"
    : !improved
    ? "#c9190b"
    : absPct >= 50
    ? "#3e8635"
    : "#f0ab00";
  const barWidth = Math.min(100, absPct);
  const direction = same
    ? "same"
    : numericallyLess
    ? `${absPct}% less`
    : `${absPct}% more`;
  return `<span class="diff-label">${direction}</span><div class="bar" style="width:${barWidth}%;background:${color}"></div>`;
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function row(
  label: string,
  valA: string | number,
  valB: string | number,
  opts?: { lowerIsBetter?: boolean },
): string {
  const a = typeof valA === "number" && valA > 999
    ? fmtNum(valA)
    : String(valA);
  const b = typeof valB === "number" && valB > 999
    ? fmtNum(valB)
    : String(valB);
  const lowerIsBetter = opts?.lowerIsBetter ?? true;
  let barHtml = "";
  if (typeof valA === "number" && typeof valB === "number") {
    barHtml = diffBar(valA, valB, lowerIsBetter);
  }
  const entry = getMetricEntry(label);
  const labelHtml = entry
    ? `<span class="has-tip" tabindex="0">${label}<span class="tip-icon">?</span><span class="tooltip"><strong>${
      escAttr(entry.short)
    }</strong><br><br><em>How it's calculated:</em> ${
      escAttr(entry.calc)
    }<br><br><em>What it means:</em> ${escAttr(entry.meaning)}</span></span>`
    : label;
  return `<tr><td>${labelHtml}</td><td class="num">${a}</td><td class="num">${b}</td><td class="bar-cell">${barHtml}</td></tr>`;
}

function sectionHeader(title: string): string {
  return `<tr class="section-row"><td colspan="5">${title}</td></tr>`;
}

function singleRow(
  label: string,
  val: string | number,
): string {
  const v = typeof val === "number" && val > 999 ? fmtNum(val) : String(val);
  const entry = getMetricEntry(label);
  const labelHtml = entry
    ? `<span class="has-tip" tabindex="0">${label}<span class="tip-icon">?</span><span class="tooltip"><strong>${
      escAttr(entry.short)
    }</strong><br><br><em>How it's calculated:</em> ${
      escAttr(entry.calc)
    }<br><br><em>What it means:</em> ${escAttr(entry.meaning)}</span></span>`
    : label;
  return `<tr><td>${labelHtml}</td><td class="num">${v}</td></tr>`;
}

function generateSingleHtmlReport(
  report: FullReport,
  liveReloadScript: string,
): string {
  const f = report.folderA;
  const langRows = Object.entries(f.scc).map(([lang, data]) =>
    `<tr><td>${lang}</td><td class="num">${
      fmtNum(data.files)
    }</td><td class="num">${fmtNum(data.code)}</td><td class="num">${
      fmtNum(data.complexity)
    }</td></tr>`
  ).join("\n");

  const hotspotRows = f.topFiles.slice(0, 10).map((file) => {
    const short = file.file.replace(f.path, "").replace(/^\//, "");
    return `<tr><td>${short}</td><td class="num">${
      fmtNum(file.code)
    }</td><td class="num">${fmtNum(file.complexity)}</td></tr>`;
  }).join("\n");

  const beretSection = f.beret
    ? `
    ${sectionHeader("Structural Analysis (Beret)")}
    ${singleRow("Functions", f.beret.architecture.counts.functions)}
    ${singleRow("Classes", f.beret.architecture.counts.classes)}
    ${singleRow("Test functions", f.beret.testing.test_functions)}
    ${singleRow("Test ratio (%)", f.beret.testing.test_ratio_percent)}
    <tr><td>Architecture layers</td><td class="num">${
      f.beret.architecture.layers.join(", ") || "—"
    }</td></tr>
  `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tweed — Codebase Analysis</title>
${liveReloadScript}
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: "Red Hat Text", system-ui, sans-serif; background: #1b1d21; color: #e0e0e0; margin: 0; padding: 2rem; max-width: 900px; margin: 0 auto; }
  h1 { text-align: center; font-size: 2rem; margin-bottom: 0.25rem; }
  .meta { text-align: center; color: #999; margin-bottom: 2rem; font-size: 0.875rem; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
  .summary-card { background: rgba(41,41,41,0.5); border: 1px solid #444; border-radius: 12px; padding: 1.25rem; text-align: center; }
  .summary-card .value { font-size: 2.25rem; font-weight: 700; font-family: "Red Hat Mono", monospace; }
  .summary-card .label { color: #999; font-size: 0.8rem; margin-top: 0.25rem; }
  .summary-card.green .value { color: #92d68a; }
  .summary-card.blue .value { color: #73bcf7; }
  .summary-card.orange .value { color: #f4c145; }
  table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; font-size: 0.875rem; }
  th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 2px solid #444; color: #999; font-weight: 500; }
  th.num { text-align: right; }
  td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #292929; }
  tr:hover { background: rgba(255,255,255,0.03); }
  .num { text-align: right; font-family: "Red Hat Mono", monospace; }
  .section-row td { padding: 1rem 0.75rem 0.4rem; border-bottom: 1px solid #444; color: #73bcf7; font-weight: 600; font-size: 0.9rem; letter-spacing: 0.02em; }
  .has-tip { position: relative; cursor: help; border-bottom: 1px dotted #666; }
  .tip-icon { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; background: #444; color: #aaa; font-size: 0.65rem; font-weight: 700; margin-left: 5px; vertical-align: middle; line-height: 1; }
  .tooltip { display: none; position: absolute; left: 0; top: calc(100% + 6px); z-index: 100; width: 380px; max-width: 90vw; padding: 0.85rem 1rem; background: #2a2a2e; border: 1px solid #555; border-radius: 8px; color: #ccc; font-size: 0.8rem; line-height: 1.5; font-weight: 400; box-shadow: 0 4px 16px rgba(0,0,0,0.4); pointer-events: none; }
  .tooltip strong { color: #f0f0f0; font-size: 0.85rem; }
  .tooltip em { color: #73bcf7; font-style: normal; font-weight: 600; }
  .has-tip:hover .tooltip, .has-tip:focus .tooltip { display: block; }
</style>
</head>
<body>
<h1>Codebase Analysis</h1>
<p class="meta">${f.label} &mdash; Generated ${new Date().toLocaleString()}</p>

<div class="summary-grid">
  <div class="summary-card green"><div class="value">${
    fmtNum(f.totals.code)
  }</div><div class="label">Lines of code</div></div>
  <div class="summary-card green"><div class="value">${
    fmtNum(f.totals.files)
  }</div><div class="label">Source files</div></div>
  <div class="summary-card blue"><div class="value">${f.ai.codeHealth}</div><div class="label">CodeHealth</div></div>
  <div class="summary-card blue"><div class="value">${f.ai.clarity}</div><div class="label">LLM Clarity</div></div>
  <div class="summary-card orange"><div class="value">$${
    fmtNum(f.cocomo.estimatedCost)
  }</div><div class="label">COCOMO cost</div></div>
</div>

<table>
  <thead><tr><th>Metric</th><th class="num">Value</th></tr></thead>
  <tbody>
    ${sectionHeader("Code Size")}
    ${singleRow("Source files", f.totals.files)}
    ${singleRow("Lines of code", f.totals.code)}
    ${singleRow("Comments", f.totals.comments)}

    ${sectionHeader("Complexity")}
    ${singleRow("Cyclomatic complexity", f.totals.complexity)}
    ${singleRow("Cognitive complexity", f.ai.cognitiveComplexity)}
    ${singleRow("Max nesting depth", f.ai.details.maxNestingDepth)}
    ${singleRow("Avg function length", f.ai.details.avgFunctionLength)}
    ${
    singleRow("Conditional density (/100 LOC)", f.ai.details.conditionalDensity)
  }
    ${
    singleRow("Conditionals per function", f.ai.details.condDensityPerFunction)
  }

    ${sectionHeader("Dependencies & Config")}
    ${singleRow("Dependencies", f.dependencies.total)}
    ${singleRow("Production deps", f.dependencies.production)}
    ${singleRow("Dev deps", f.dependencies.development)}
    ${singleRow("Config files", f.configFiles)}
    ${singleRow("Build/task scripts", f.scripts)}

    ${sectionHeader("AI Friendliness")}
    ${singleRow("CodeHealth score (0-100)", f.ai.codeHealth)}
    ${singleRow("LLM Clarity (0-100)", f.ai.clarity)}
    ${singleRow("Naming score (0-100)", f.ai.details.namingScore)}
    ${singleRow("Comment density (%)", f.ai.details.commentDensity)}

    ${sectionHeader("Token Economy")}
    ${singleRow("LLM context tokens", f.tokens.estimatedTokens)}
    ${singleRow("Tokens per file", f.tokens.tokensPerFile)}
    ${singleRow("Direct tokens", f.ai.tokenFanOut.direct)}
    ${singleRow("Fan-out tokens", f.ai.tokenFanOut.fanOut)}
    ${singleRow("Context fan-out total", f.ai.tokenFanOut.total)}
    ${singleRow("Fan-out files", f.ai.tokenFanOut.fanOutFiles)}

    ${sectionHeader("COCOMO Estimates")}
    ${singleRow("Estimated cost ($)", f.cocomo.estimatedCost)}
    ${singleRow("Schedule (months)", f.cocomo.scheduleMonths)}

    ${beretSection}

    ${sectionHeader("Language Breakdown")}
    ${langRows}
  </tbody>
</table>

<h2 style="border-bottom:1px solid #444;padding-bottom:0.5rem;color:#73bcf7;margin-top:2.5rem">Complexity Hotspots</h2>
<p style="color:#999;font-size:0.875rem">Top 10 files by cyclomatic complexity</p>
<table>
  <thead><tr><th>File</th><th class="num">Code</th><th class="num">CC</th></tr></thead>
  <tbody>${hotspotRows}</tbody>
</table>

</body>
</html>`;
}

export function generateHtmlReport(
  report: FullReport,
  opts?: { liveReload?: boolean },
): string {
  const liveReloadScript = opts?.liveReload
    ? `<script>
  const es = new EventSource("/__sse");
  es.onmessage = () => location.reload();
  es.onerror = () => setTimeout(() => location.reload(), 2000);
</script>`
    : "";

  if (!report.folderB) {
    return generateSingleHtmlReport(report, liveReloadScript);
  }

  const d = report as FullReport & { folderB: FolderReport };
  const labelA = d.folderA.label;
  const labelB = d.folderB.label;

  type SccVal = {
    files: number;
    code: number;
    complexity: number;
  };

  const langBreakdown = (() => {
    const allLangs = new Set([
      ...Object.keys(d.folderA.scc),
      ...Object.keys(d.folderB.scc),
    ]);
    const oScc = d.folderA.scc as Record<string, SccVal>;
    const rScc = d.folderB.scc as Record<string, SccVal>;
    return [...allLangs].map((lang) => {
      const ov = oScc[lang];
      const rv = rScc[lang];
      const oHtml = ov
        ? `<span class="lang-cell">${
          fmtNum(ov.files)
        } files<span class="lang-sub">${fmtNum(ov.code)} code</span></span>`
        : "—";
      const rHtml = rv
        ? `<span class="lang-cell">${
          fmtNum(rv.files)
        } files<span class="lang-sub">${fmtNum(rv.code)} code</span></span>`
        : "—";
      const oCode = ov?.code ?? 0;
      const rCode = rv?.code ?? 0;
      const codeBar = oCode || rCode ? diffBar(oCode, rCode) : "";
      return `<tr><td>${lang}</td><td class="num">${oHtml}</td><td class="num">${rHtml}</td><td class="bar-cell">${codeBar}</td></tr>`;
    }).join("\n");
  })();

  function hotspotTable(
    label: string,
    files: FileMetric[],
    basePath: string,
  ): string {
    return `
    <div>
      <h3 style="color:#c7c7c7">${label}</h3>
      <table>
        <thead><tr><th>File</th><th class="num">Code</th><th class="num">CC</th></tr></thead>
        <tbody>${
      files.slice(0, 10).map((f) => {
        const short = f.file.replace(basePath, "").replace(/^\//, "");
        return `<tr><td>${short}</td><td class="num">${
          fmtNum(f.code)
        }</td><td class="num">${fmtNum(f.complexity)}</td></tr>`;
      }).join("\n")
    }</tbody>
      </table>
    </div>`;
  }

  const beretSection = d.folderA.beret && d.folderB.beret
    ? `
    ${sectionHeader("Structural Analysis (Beret)")}
    ${
      row(
        "Functions",
        d.folderA.beret.architecture.counts.functions,
        d.folderB.beret.architecture.counts.functions,
      )
    }
    ${
      row(
        "Classes",
        d.folderA.beret.architecture.counts.classes,
        d.folderB.beret.architecture.counts.classes,
      )
    }
    ${
      row(
        "Config files (detected)",
        d.folderA.beret.architecture.counts.config_files,
        d.folderB.beret.architecture.counts.config_files,
      )
    }
    ${
      row(
        "Documents",
        d.folderA.beret.architecture.counts.documents,
        d.folderB.beret.architecture.counts.documents,
      )
    }
    ${
      row(
        "Binary assets",
        d.folderA.beret.architecture.counts.binary_assets,
        d.folderB.beret.architecture.counts.binary_assets,
      )
    }
    ${
      row(
        "Test functions",
        d.folderA.beret.testing.test_functions,
        d.folderB.beret.testing.test_functions,
      )
    }
    ${
      row(
        "Test ratio (%)",
        d.folderA.beret.testing.test_ratio_percent,
        d.folderB.beret.testing.test_ratio_percent,
        { lowerIsBetter: false },
      )
    }
    <tr><td>Architecture layers</td><td class="num">${
      d.folderA.beret.architecture.layers.join(", ") || "—"
    }</td><td class="num">${
      d.folderB.beret.architecture.layers.join(", ") || "—"
    }</td><td class="bar-cell"></td></tr>
  `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tweed — Codebase Comparison</title>
${liveReloadScript}
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: "Red Hat Text", system-ui, sans-serif; background: #1b1d21; color: #e0e0e0; margin: 0; padding: 2rem; max-width: 1200px; margin: 0 auto; }
  h1 { text-align: center; font-size: 2rem; margin-bottom: 0.25rem; }
  .meta { text-align: center; color: #999; margin-bottom: 2rem; font-size: 0.875rem; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
  .summary-card { background: rgba(41,41,41,0.5); border: 1px solid #444; border-radius: 12px; padding: 1.25rem; text-align: center; }
  .summary-card .value { font-size: 2.25rem; font-weight: 700; font-family: "Red Hat Mono", monospace; }
  .summary-card .label { color: #999; font-size: 0.8rem; margin-top: 0.25rem; }
  .summary-card.green .value { color: #92d68a; }
  .summary-card.blue .value { color: #73bcf7; }
  .summary-card.orange .value { color: #f4c145; }
  table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; font-size: 0.875rem; }
  th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 2px solid #444; color: #999; font-weight: 500; }
  th.num { text-align: right; }
  td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #292929; }
  tr:hover { background: rgba(255,255,255,0.03); }
  .num { text-align: right; font-family: "Red Hat Mono", monospace; }
  .bar { height: 16px; border-radius: 3px; min-width: 2px; }
  .bar-cell { width: 22%; }
  .diff-label { font-size: 0.75rem; font-family: "Red Hat Mono", monospace; color: #999; margin-bottom: 2px; display: block; }
  .lang-cell { line-height: 1.6; }
  .lang-sub { display: block; font-size: 0.75rem; color: #777; }
  .section-row td {
    padding: 1rem 0.75rem 0.4rem;
    border-bottom: 1px solid #444;
    color: #73bcf7;
    font-weight: 600;
    font-size: 0.9rem;
    letter-spacing: 0.02em;
  }
  .has-tip { position: relative; cursor: help; border-bottom: 1px dotted #666; }
  .tip-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 15px; height: 15px; border-radius: 50%; background: #444;
    color: #aaa; font-size: 0.65rem; font-weight: 700; margin-left: 5px;
    vertical-align: middle; line-height: 1;
  }
  .tooltip {
    display: none; position: absolute; left: 0; top: calc(100% + 6px);
    z-index: 100; width: 380px; max-width: 90vw; padding: 0.85rem 1rem;
    background: #2a2a2e; border: 1px solid #555; border-radius: 8px;
    color: #ccc; font-size: 0.8rem; line-height: 1.5; font-weight: 400;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4); pointer-events: none;
  }
  .tooltip strong { color: #f0f0f0; font-size: 0.85rem; }
  .tooltip em { color: #73bcf7; font-style: normal; font-weight: 600; }
  .has-tip:hover .tooltip, .has-tip:focus .tooltip { display: block; }
</style>
</head>
<body>
<h1>Codebase Comparison</h1>
<p class="meta">${labelA} vs ${labelB} &mdash; Generated ${
    new Date().toLocaleString()
  }</p>

<div class="summary-grid">
  <div class="summary-card green">
    <div class="value">${
    pct(d.folderA.totals.code, d.folderB.totals.code)
  }</div>
    <div class="label">Less code</div>
  </div>
  <div class="summary-card green">
    <div class="value">${
    pct(d.folderA.totals.complexity, d.folderB.totals.complexity)
  }</div>
    <div class="label">Less complexity</div>
  </div>
  <div class="summary-card blue">
    <div class="value">${
    pct(d.folderA.dependencies.total, d.folderB.dependencies.total)
  }</div>
    <div class="label">Fewer dependencies</div>
  </div>
  <div class="summary-card blue">
    <div class="value">${
    pct(d.folderA.tokens.estimatedTokens, d.folderB.tokens.estimatedTokens)
  }</div>
    <div class="label">Smaller LLM context</div>
  </div>
  <div class="summary-card orange">
    <div class="value">${
    pct(d.folderA.cocomo.estimatedCost, d.folderB.cocomo.estimatedCost)
  }</div>
    <div class="label">Lower COCOMO cost</div>
  </div>
</div>

<table>
  <thead><tr><th>Metric</th><th class="num">${labelA}</th><th class="num">${labelB}</th><th class="bar-cell">Difference</th></tr></thead>
  <tbody>
    ${sectionHeader("Code Size")}
    ${row("Source files", d.folderA.totals.files, d.folderB.totals.files)}
    ${row("Lines of code", d.folderA.totals.code, d.folderB.totals.code)}
    ${row("Comments", d.folderA.totals.comments, d.folderB.totals.comments)}

    ${sectionHeader("Complexity")}
    ${
    row(
      "Cyclomatic complexity",
      d.folderA.totals.complexity,
      d.folderB.totals.complexity,
    )
  }
    ${
    row(
      "Cognitive complexity",
      d.folderA.ai.cognitiveComplexity,
      d.folderB.ai.cognitiveComplexity,
    )
  }
    ${
    row(
      "Max nesting depth",
      d.folderA.ai.details.maxNestingDepth,
      d.folderB.ai.details.maxNestingDepth,
    )
  }
    ${
    row(
      "Avg function length",
      d.folderA.ai.details.avgFunctionLength,
      d.folderB.ai.details.avgFunctionLength,
    )
  }
    ${
    row(
      "Conditional density (/100 LOC)",
      d.folderA.ai.details.conditionalDensity,
      d.folderB.ai.details.conditionalDensity,
    )
  }
    ${
    row(
      "Conditionals per function",
      d.folderA.ai.details.condDensityPerFunction,
      d.folderB.ai.details.condDensityPerFunction,
    )
  }

    ${sectionHeader("Dependencies & Config")}
    ${
    row(
      "Dependencies",
      d.folderA.dependencies.total,
      d.folderB.dependencies.total,
    )
  }
    ${
    row(
      "Production deps",
      d.folderA.dependencies.production,
      d.folderB.dependencies.production,
    )
  }
    ${
    row(
      "Dev deps",
      d.folderA.dependencies.development,
      d.folderB.dependencies.development,
    )
  }
    ${row("Config files", d.folderA.configFiles, d.folderB.configFiles)}
    ${row("Build/task scripts", d.folderA.scripts, d.folderB.scripts)}

    ${sectionHeader("AI Friendliness")}
    ${
    row(
      "CodeHealth score (0-100)",
      d.folderA.ai.codeHealth,
      d.folderB.ai.codeHealth,
      { lowerIsBetter: false },
    )
  }
    ${
    row("LLM Clarity (0-100)", d.folderA.ai.clarity, d.folderB.ai.clarity, {
      lowerIsBetter: false,
    })
  }
    ${
    row(
      "Naming score (0-100)",
      d.folderA.ai.details.namingScore,
      d.folderB.ai.details.namingScore,
      { lowerIsBetter: false },
    )
  }
    ${
    row(
      "Comment density (%)",
      d.folderA.ai.details.commentDensity,
      d.folderB.ai.details.commentDensity,
      { lowerIsBetter: false },
    )
  }

    ${sectionHeader("Token Economy")}
    ${
    row(
      "LLM context tokens",
      d.folderA.tokens.estimatedTokens,
      d.folderB.tokens.estimatedTokens,
    )
  }
    ${
    row(
      "Tokens per file",
      d.folderA.tokens.tokensPerFile,
      d.folderB.tokens.tokensPerFile,
    )
  }
    ${
    row(
      "Direct tokens",
      d.folderA.ai.tokenFanOut.direct,
      d.folderB.ai.tokenFanOut.direct,
    )
  }
    ${
    row(
      "Fan-out tokens",
      d.folderA.ai.tokenFanOut.fanOut,
      d.folderB.ai.tokenFanOut.fanOut,
    )
  }
    ${
    row(
      "Context fan-out total",
      d.folderA.ai.tokenFanOut.total,
      d.folderB.ai.tokenFanOut.total,
    )
  }
    ${
    row(
      "Fan-out files",
      d.folderA.ai.tokenFanOut.fanOutFiles,
      d.folderB.ai.tokenFanOut.fanOutFiles,
    )
  }

    ${sectionHeader("COCOMO Estimates")}
    ${
    row(
      "Estimated cost ($)",
      d.folderA.cocomo.estimatedCost,
      d.folderB.cocomo.estimatedCost,
    )
  }
    ${
    row(
      "Schedule (months)",
      d.folderA.cocomo.scheduleMonths,
      d.folderB.cocomo.scheduleMonths,
    )
  }

    ${beretSection}

    ${sectionHeader("Language Breakdown")}
    ${langBreakdown}
  </tbody>
</table>

<h2 style="border-bottom:1px solid #444;padding-bottom:0.5rem;color:#73bcf7;margin-top:2.5rem">Complexity Hotspots</h2>
<p style="color:#999;font-size:0.875rem">Top 10 files by cyclomatic complexity</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem">
  ${hotspotTable(labelA, d.folderA.topFiles, d.folderA.path)}
  ${hotspotTable(labelB, d.folderB.topFiles, d.folderB.path)}
</div>

</body>
</html>`;
}
