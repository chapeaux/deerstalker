#!/usr/bin/env -S deno run -A
import type { ComparisonRow, FolderReport, FullReport } from "./lib/types.ts";
import {
  cocomo,
  computeAiMetrics,
  countConfigFiles,
  countDeps,
  countScripts,
  countTokens,
  runScc,
  runSccByFile,
  sccBreakdown,
  sccTotals,
} from "./lib/metrics.ts";
import { setSccBin } from "./lib/metrics.ts";
import { collectBeretData, setBeretBin } from "./lib/beret.ts";
import { generateHtmlReport } from "./lib/report-html.ts";
import { generateMdReport } from "./lib/report-md.ts";
import { notifyReload, startServer } from "./lib/server.ts";
import { startWatcher } from "./lib/watcher.ts";
import { GLOSSARY } from "./lib/glossary.ts";
import { ensureDeps } from "./lib/deps.ts";

const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

function parseFlag(args: string[], flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

function parseListFlag(args: string[], flag: string): string[] {
  const val = parseFlag(args, flag, "");
  return val ? val.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function basename(path: string): string {
  return path.replace(/\/$/, "").split("/").pop() ?? path;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function pct(a: number, b: number): string {
  if (a === 0) return "0%";
  return `${Math.round(((a - b) / a) * 100)}%`;
}

function showHelp() {
  console.error(`
${
    bold("tweed")
  } — Compare two codebases across metrics, complexity, and AI-friendliness

${bold("Usage:")}
  tweed <folder-a> <folder-b> [options]

${bold("Options:")}
  --label-a <name>       Label for folder A (default: directory name)
  --label-b <name>       Label for folder B (default: directory name)
  -o, --output <dir>     Output directory (default: ./tweed-output)
  -f, --format <list>    Comma-separated: json,html,md (default: json,html,md)
  --exclude-a <dirs>     Comma-separated dirs to exclude from A
  --exclude-b <dirs>     Comma-separated dirs to exclude from B
  --src-a <subdirs>      Source subdirs within A (default: A root)
  --src-b <subdirs>      Source subdirs within B (default: B root)
  --json                 Also print JSON to stdout
  --no-beret             Skip beret analysis
  --serve [port]         Start web server (default port: 3000)
  --watch                Watch folders for changes and reassess
  --glossary             Print metric explanations and exit
  --help                 Show this help

${bold("Requires:")} scc on PATH
${bold("Optional:")} beret on PATH (structural analysis)
`);
}

const args = [...Deno.args];

if (hasFlag(args, "--help") || hasFlag(args, "-h") || args.length === 0) {
  showHelp();
  Deno.exit(0);
}

if (hasFlag(args, "--glossary")) {
  console.error("");
  console.error(bold(cyan("  Tweed — Metric Glossary")));
  console.error("");
  for (const entry of GLOSSARY) {
    console.error(bold(`  ${entry.name}`));
    console.error(`  ${entry.short}`);
    console.error(dim(`  Calculation: ${entry.calc}`));
    console.error(dim(`  Meaning: ${entry.meaning}`));
    console.error("");
  }
  Deno.exit(0);
}

const FLAGS_WITH_VALUE = new Set([
  "--label-a",
  "--label-b",
  "-o",
  "--output",
  "-f",
  "--format",
  "--exclude-a",
  "--exclude-b",
  "--src-a",
  "--src-b",
  "--serve",
]);
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("-")) {
    if (FLAGS_WITH_VALUE.has(args[i]) && i + 1 < args.length) i++;
    continue;
  }
  positional.push(args[i]);
}

if (positional.length < 1) {
  console.error(red("  Error: at least one folder path required"));
  console.error("  Usage: tweed <folder-a> [folder-b] [options]");
  Deno.exit(1);
}

const singleMode = positional.length === 1;
const folderAPath = Deno.realPathSync(positional[0]);
const folderBPath = singleMode ? "" : Deno.realPathSync(positional[1]);

const labelA = parseFlag(args, "--label-a", basename(folderAPath));
const labelB = singleMode
  ? ""
  : parseFlag(args, "--label-b", basename(folderBPath));
const outDir = parseFlag(
  args,
  "-o",
  parseFlag(args, "--output", "./tweed-output"),
);
const formats = parseFlag(
  args,
  "-f",
  parseFlag(args, "--format", "json,html,md"),
)
  .split(",").map((s) => s.trim());
const DEFAULT_EXCLUDES = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".deno",
  "vendor",
  "coverage",
  ".next",
  ".nuxt",
  "__pycache__",
  ".cache",
  "target",
  ".parcel-cache",
  ".svelte-kit",
  ".output",
  ".turbo",
  "tweed-output",
];
const excludeA = [...DEFAULT_EXCLUDES, ...parseListFlag(args, "--exclude-a")];
const excludeB = [...DEFAULT_EXCLUDES, ...parseListFlag(args, "--exclude-b")];
const srcA = parseListFlag(args, "--src-a");
const srcB = parseListFlag(args, "--src-b");
const printJson = hasFlag(args, "--json");
const noBeret = hasFlag(args, "--no-beret");
const watchMode = hasFlag(args, "--watch");

let servePort = 0;
const serveIdx = args.indexOf("--serve");
if (serveIdx !== -1) {
  const nextArg = args[serveIdx + 1];
  servePort = nextArg && /^\d+$/.test(nextArg) ? parseInt(nextArg, 10) : 3000;
}

const dirsA = srcA.length > 0
  ? srcA.map((s) => `${folderAPath}/${s}`)
  : [folderAPath];
const dirsB = singleMode
  ? []
  : srcB.length > 0
  ? srcB.map((s) => `${folderBPath}/${s}`)
  : [folderBPath];

const deps = await ensureDeps(noBeret, (msg) => console.error(dim(`  ${msg}`)));
setSccBin(deps.scc);
if (deps.beret) setBeretBin(deps.beret);

async function collectFolder(
  label: string,
  path: string,
  dirs: string[],
  excludes: string[],
  stepOffset: number,
  totalSteps: number,
): Promise<FolderReport> {
  const pfx = singleMode ? "" : ` (${label})`;
  console.error(
    dim(`  [${stepOffset + 1}/${totalSteps}] Running scc${pfx}...`),
  );
  const [scc, files] = await Promise.all([
    runScc(dirs, excludes),
    runSccByFile(dirs, excludes),
  ]);

  console.error(
    dim(`  [${stepOffset + 2}/${totalSteps}] Counting tokens${pfx}...`),
  );
  const tokens = await countTokens(dirs, excludes);

  console.error(
    dim(`  [${stepOffset + 3}/${totalSteps}] Counting deps${pfx}...`),
  );
  const [depMetrics, configs, scripts] = await Promise.all([
    countDeps(path),
    countConfigFiles(path),
    countScripts(path),
  ]);

  console.error(
    dim(`  [${stepOffset + 4}/${totalSteps}] Computing AI metrics${pfx}...`),
  );
  const ai = await computeAiMetrics(dirs, excludes);

  let beret;
  if (deps.beret) {
    console.error(
      dim(`  [${stepOffset + 5}/${totalSteps}] Running beret${pfx}...`),
    );
    beret = await collectBeretData(path, excludes);
  }

  const totals = sccTotals(scc);
  return {
    label,
    path,
    scc: sccBreakdown(scc),
    totals,
    tokens,
    dependencies: depMetrics,
    configFiles: configs,
    scripts,
    cocomo: cocomo(totals.code / 1000),
    topFiles: files,
    ai,
    beret,
  };
}

async function runAssessment(): Promise<FullReport> {
  console.error("");
  if (singleMode) {
    console.error(bold(cyan("  Tweed — Codebase Analysis")));
    console.error(dim(`  ${folderAPath}`));
  } else {
    console.error(bold(cyan("  Tweed — Codebase Comparison")));
    console.error(dim(`  A: ${folderAPath}`));
    console.error(dim(`  B: ${folderBPath}`));
  }
  console.error("");

  const stepsPerFolder = deps.beret ? 5 : 4;
  const totalSteps = singleMode ? stepsPerFolder : stepsPerFolder * 2;

  const folderA = await collectFolder(
    labelA,
    folderAPath,
    dirsA,
    excludeA,
    0,
    totalSteps,
  );

  if (singleMode) {
    return { timestamp: new Date().toISOString(), folderA };
  }

  const folderB = await collectFolder(
    labelB,
    folderBPath,
    dirsB,
    excludeB,
    stepsPerFolder,
    totalSteps,
  );

  const comparison: ComparisonRow[] = [
    {
      label: "Source files",
      a: folderA.totals.files,
      b: folderB.totals.files,
      reduction: pct(folderA.totals.files, folderB.totals.files),
    },
    {
      label: "Lines of code",
      a: folderA.totals.code,
      b: folderB.totals.code,
      reduction: pct(folderA.totals.code, folderB.totals.code),
    },
    {
      label: "Cyclomatic complexity",
      a: folderA.totals.complexity,
      b: folderB.totals.complexity,
      reduction: pct(folderA.totals.complexity, folderB.totals.complexity),
    },
    {
      label: "Cognitive complexity",
      a: folderA.ai.cognitiveComplexity,
      b: folderB.ai.cognitiveComplexity,
      reduction: pct(
        folderA.ai.cognitiveComplexity,
        folderB.ai.cognitiveComplexity,
      ),
    },
    {
      label: "Comments",
      a: folderA.totals.comments,
      b: folderB.totals.comments,
      reduction: pct(folderA.totals.comments, folderB.totals.comments),
    },
    {
      label: "Dependencies",
      a: folderA.dependencies.total,
      b: folderB.dependencies.total,
      reduction: pct(folderA.dependencies.total, folderB.dependencies.total),
    },
    {
      label: "Config files",
      a: folderA.configFiles,
      b: folderB.configFiles,
      reduction: pct(folderA.configFiles, folderB.configFiles),
    },
    {
      label: "Build/task scripts",
      a: folderA.scripts,
      b: folderB.scripts,
      reduction: pct(folderA.scripts, folderB.scripts),
    },
    {
      label: "LLM context tokens",
      a: folderA.tokens.estimatedTokens,
      b: folderB.tokens.estimatedTokens,
      reduction: pct(
        folderA.tokens.estimatedTokens,
        folderB.tokens.estimatedTokens,
      ),
    },
    {
      label: "Context fan-out tokens",
      a: folderA.ai.tokenFanOut.total,
      b: folderB.ai.tokenFanOut.total,
      reduction: pct(
        folderA.ai.tokenFanOut.total,
        folderB.ai.tokenFanOut.total,
      ),
    },
    {
      label: "COCOMO estimated cost",
      a: folderA.cocomo.estimatedCost,
      b: folderB.cocomo.estimatedCost,
      reduction: pct(
        folderA.cocomo.estimatedCost,
        folderB.cocomo.estimatedCost,
      ),
    },
    {
      label: "COCOMO schedule (months)",
      a: folderA.cocomo.scheduleMonths,
      b: folderB.cocomo.scheduleMonths,
      reduction: pct(
        folderA.cocomo.scheduleMonths,
        folderB.cocomo.scheduleMonths,
      ),
    },
  ];

  return {
    timestamp: new Date().toISOString(),
    folderA,
    folderB,
    comparison,
  };
}

async function writeReports(report: FullReport) {
  await Deno.mkdir(outDir, { recursive: true });
  const prefix = singleMode ? "analysis" : "comparison";

  if (formats.includes("json")) {
    await Deno.writeTextFile(
      `${outDir}/${prefix}.json`,
      JSON.stringify(report, null, 2),
    );
  }

  if (formats.includes("html")) {
    const html = generateHtmlReport(report, {
      liveReload: servePort > 0 && watchMode,
    });
    await Deno.writeTextFile(`${outDir}/${prefix}.html`, html);
  }

  if (formats.includes("md")) {
    const md = generateMdReport(report);
    await Deno.writeTextFile(`${outDir}/${prefix}.md`, md);
  }
}

function printSummary(report: FullReport) {
  console.error("");
  const filePrefix = singleMode ? "analysis" : "comparison";

  if (singleMode) {
    const f = report.folderA;
    console.error(bold(green(`  Analysis: ${labelA}`)));
    console.error(`  ${"=".repeat(50)}`);
    console.error("");
    const rows: [string, string | number][] = [
      ["Source files", f.totals.files],
      ["Lines of code", f.totals.code],
      ["Cyclomatic complexity", f.totals.complexity],
      ["Cognitive complexity", f.ai.cognitiveComplexity],
      ["Comments", f.totals.comments],
      ["Dependencies", f.dependencies.total],
      ["Config files", f.configFiles],
      ["Build/task scripts", f.scripts],
      ["CodeHealth (0-100)", f.ai.codeHealth],
      ["LLM Clarity (0-100)", f.ai.clarity],
      ["LLM context tokens", f.tokens.estimatedTokens],
      ["COCOMO estimated cost", f.cocomo.estimatedCost],
      ["COCOMO schedule (months)", f.cocomo.scheduleMonths],
    ];
    const hdr = `  ${"Metric".padEnd(28)}|${"Value".padStart(16)}`;
    const sep = `  ${"─".repeat(28)}┼${"─".repeat(16)}`;
    console.error(hdr);
    console.error(sep);
    for (const [label, val] of rows) {
      const v = typeof val === "number" && val > 999
        ? fmtNum(val)
        : String(val);
      console.error(`  ${label.padEnd(28)}|${v.padStart(16)}`);
    }
  } else {
    console.error(bold(green(`  Comparison: ${labelA} vs ${labelB}`)));
    console.error(`  ${"=".repeat(72)}`);
    console.error("");
    const hdr = `  ${"Metric".padEnd(28)}|${labelA.padStart(16)} |${
      labelB.padStart(14)
    } |${"Reduction".padStart(10)}`;
    const sep = `  ${"─".repeat(28)}┼${"─".repeat(16)}─┼${"─".repeat(14)}─┼${
      "─".repeat(10)
    }`;
    console.error(hdr);
    console.error(sep);
    for (const row of report.comparison!) {
      const a = typeof row.a === "number" && row.a > 999
        ? fmtNum(row.a)
        : String(row.a);
      const b = typeof row.b === "number" && row.b > 999
        ? fmtNum(row.b)
        : String(row.b);
      console.error(
        `  ${row.label.padEnd(28)}|${a.padStart(16)} |${b.padStart(14)} |${
          row.reduction.padStart(10)
        }`,
      );
    }
  }

  console.error("");
  const written = formats.map((f) => {
    const ext = f === "md" ? "md" : f === "html" ? "html" : "json";
    return `${filePrefix}.${ext}`;
  }).join(", ");
  console.error(`  ${green("Output:")} ${cyan(outDir)}/${written}`);
  console.error("");
}

const report = await runAssessment();
await writeReports(report);
printSummary(report);

if (printJson) {
  console.log(JSON.stringify(report, null, 2));
}

if (servePort > 0) {
  const resolvedOut = Deno.realPathSync(outDir);
  startServer(resolvedOut, servePort, watchMode);
  console.error(
    `  ${green("Serving at")} ${cyan(`http://localhost:${servePort}`)}`,
  );
  if (watchMode) {
    console.error(`  ${green("Live reload")} enabled`);
  }
  console.error("");
}

if (watchMode) {
  console.error(`  ${green("Watching")} for changes...`);
  console.error("");

  const allExcludes = [
    ...new Set([...excludeA, ...excludeB, "node_modules", ".git", ".deno"]),
  ];

  await startWatcher({
    dirs: singleMode ? [folderAPath] : [folderAPath, folderBPath],
    excludeDirs: allExcludes,
    onChange: async () => {
      console.error(dim("  Reassessing..."));
      const updated = await runAssessment();
      await writeReports(updated);
      printSummary(updated);
      if (servePort > 0) {
        notifyReload();
        console.error(`  ${green("Browser reloaded")}`);
      }
    },
  });
}
