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

if (positional.length < 2) {
  console.error(red("  Error: two folder paths required"));
  console.error("  Usage: tweed <folder-a> <folder-b> [options]");
  Deno.exit(1);
}

const folderAPath = Deno.realPathSync(positional[0]);
const folderBPath = Deno.realPathSync(positional[1]);

const labelA = parseFlag(args, "--label-a", basename(folderAPath));
const labelB = parseFlag(args, "--label-b", basename(folderBPath));
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
const dirsB = srcB.length > 0
  ? srcB.map((s) => `${folderBPath}/${s}`)
  : [folderBPath];

const deps = await ensureDeps(noBeret, (msg) => console.error(dim(`  ${msg}`)));
setSccBin(deps.scc);
if (deps.beret) setBeretBin(deps.beret);

async function runAssessment(): Promise<FullReport> {
  console.error("");
  console.error(bold(cyan("  Tweed — Codebase Comparison")));
  console.error(dim(`  A: ${folderAPath}`));
  console.error(dim(`  B: ${folderBPath}`));
  console.error("");

  console.error(dim("  [1/7] Running scc..."));
  const [sccA, sccB, filesA, filesB] = await Promise.all([
    runScc(dirsA, excludeA),
    runScc(dirsB, excludeB),
    runSccByFile(dirsA, excludeA),
    runSccByFile(dirsB, excludeB),
  ]);

  console.error(dim("  [2/7] Counting tokens..."));
  const [tokensA, tokensB] = await Promise.all([
    countTokens(dirsA, excludeA),
    countTokens(dirsB, excludeB),
  ]);

  console.error(dim("  [3/7] Counting dependencies..."));
  const [depsA, depsB] = await Promise.all([
    countDeps(folderAPath),
    countDeps(folderBPath),
  ]);

  console.error(dim("  [4/7] Counting configs..."));
  const [configsA, configsB, scriptsA, scriptsB] = await Promise.all([
    countConfigFiles(folderAPath),
    countConfigFiles(folderBPath),
    countScripts(folderAPath),
    countScripts(folderBPath),
  ]);

  console.error(dim("  [5/7] Computing AI metrics (A)..."));
  const aiA = await computeAiMetrics(dirsA, excludeA);

  console.error(dim("  [6/7] Computing AI metrics (B)..."));
  const aiB = await computeAiMetrics(dirsB, excludeB);

  let beretA, beretB;
  if (deps.beret) {
    console.error(dim("  [7/7] Running beret analysis..."));
    [beretA, beretB] = await Promise.all([
      collectBeretData(folderAPath, excludeA),
      collectBeretData(folderBPath, excludeB),
    ]);
  } else {
    console.error(dim("  [7/7] Skipping beret analysis"));
  }

  const totA = sccTotals(sccA);
  const totB = sccTotals(sccB);
  const cocomoA = cocomo(totA.code / 1000);
  const cocomoB = cocomo(totB.code / 1000);

  const comparison: ComparisonRow[] = [
    {
      label: "Source files",
      a: totA.files,
      b: totB.files,
      reduction: pct(totA.files, totB.files),
    },
    {
      label: "Lines of code",
      a: totA.code,
      b: totB.code,
      reduction: pct(totA.code, totB.code),
    },
    {
      label: "Cyclomatic complexity",
      a: totA.complexity,
      b: totB.complexity,
      reduction: pct(totA.complexity, totB.complexity),
    },
    {
      label: "Cognitive complexity",
      a: aiA.cognitiveComplexity,
      b: aiB.cognitiveComplexity,
      reduction: pct(aiA.cognitiveComplexity, aiB.cognitiveComplexity),
    },
    {
      label: "Comments",
      a: totA.comments,
      b: totB.comments,
      reduction: pct(totA.comments, totB.comments),
    },
    {
      label: "Dependencies",
      a: depsA.total,
      b: depsB.total,
      reduction: pct(depsA.total, depsB.total),
    },
    {
      label: "Config files",
      a: configsA,
      b: configsB,
      reduction: pct(configsA, configsB),
    },
    {
      label: "Build/task scripts",
      a: scriptsA,
      b: scriptsB,
      reduction: pct(scriptsA, scriptsB),
    },
    {
      label: "LLM context tokens",
      a: tokensA.estimatedTokens,
      b: tokensB.estimatedTokens,
      reduction: pct(tokensA.estimatedTokens, tokensB.estimatedTokens),
    },
    {
      label: "Context fan-out tokens",
      a: aiA.tokenFanOut.total,
      b: aiB.tokenFanOut.total,
      reduction: pct(aiA.tokenFanOut.total, aiB.tokenFanOut.total),
    },
    {
      label: "COCOMO estimated cost",
      a: cocomoA.estimatedCost,
      b: cocomoB.estimatedCost,
      reduction: pct(cocomoA.estimatedCost, cocomoB.estimatedCost),
    },
    {
      label: "COCOMO schedule (months)",
      a: cocomoA.scheduleMonths,
      b: cocomoB.scheduleMonths,
      reduction: pct(cocomoA.scheduleMonths, cocomoB.scheduleMonths),
    },
  ];

  const folderA: FolderReport = {
    label: labelA,
    path: folderAPath,
    scc: sccBreakdown(sccA),
    totals: totA,
    tokens: tokensA,
    dependencies: depsA,
    configFiles: configsA,
    scripts: scriptsA,
    cocomo: cocomoA,
    topFiles: filesA,
    ai: aiA,
    beret: beretA,
  };

  const folderB: FolderReport = {
    label: labelB,
    path: folderBPath,
    scc: sccBreakdown(sccB),
    totals: totB,
    tokens: tokensB,
    dependencies: depsB,
    configFiles: configsB,
    scripts: scriptsB,
    cocomo: cocomoB,
    topFiles: filesB,
    ai: aiB,
    beret: beretB,
  };

  return { timestamp: new Date().toISOString(), folderA, folderB, comparison };
}

async function writeReports(report: FullReport) {
  await Deno.mkdir(outDir, { recursive: true });

  if (formats.includes("json")) {
    await Deno.writeTextFile(
      `${outDir}/comparison.json`,
      JSON.stringify(report, null, 2),
    );
  }

  if (formats.includes("html")) {
    const html = generateHtmlReport(report, {
      liveReload: servePort > 0 && watchMode,
    });
    await Deno.writeTextFile(`${outDir}/comparison.html`, html);
  }

  if (formats.includes("md")) {
    const md = generateMdReport(report);
    await Deno.writeTextFile(`${outDir}/comparison.md`, md);
  }
}

function printSummary(report: FullReport) {
  console.error("");
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

  for (const row of report.comparison) {
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

  console.error("");
  const written = formats.map((f) => {
    const ext = f === "md" ? "md" : f === "html" ? "html" : "json";
    return `comparison.${ext}`;
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
    dirs: [folderAPath, folderBPath],
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
