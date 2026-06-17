import type {
  AiMetrics,
  CocomoMetrics,
  DependencyMetrics,
  FileMetric,
  SccFile,
  SccLanguage,
  SccTotals,
  TokenMetrics,
} from "./types.ts";

export let SCC_BIN = "scc";

export function setSccBin(path: string) {
  SCC_BIN = path;
}

export async function runScc(
  dirs: string[],
  excludeDirs: string[] = [],
  notMatch: string[] = [],
): Promise<SccLanguage[]> {
  const args = [
    "--format",
    "json",
    "--no-min-gen",
    ...excludeDirs.flatMap((d) => ["--exclude-dir", d]),
    ...notMatch.flatMap((p) => ["--not-match", p]),
    ...dirs,
  ];
  const { stdout, success } = await new Deno.Command(SCC_BIN, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!success) return [];
  try {
    return JSON.parse(new TextDecoder().decode(stdout));
  } catch {
    return [];
  }
}

export async function runSccByFile(
  dirs: string[],
  excludeDirs: string[] = [],
  notMatch: string[] = [],
): Promise<FileMetric[]> {
  const args = [
    "--format",
    "json",
    "--by-file",
    "--no-min-gen",
    ...excludeDirs.flatMap((d) => ["--exclude-dir", d]),
    ...notMatch.flatMap((p) => ["--not-match", p]),
    ...dirs,
  ];
  const { stdout, success } = await new Deno.Command(SCC_BIN, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!success) return [];
  try {
    const data: SccLanguage[] = JSON.parse(new TextDecoder().decode(stdout));
    const files: FileMetric[] = [];
    for (const lang of data) {
      for (const f of (lang as unknown as { Files: SccFile[] }).Files ?? []) {
        files.push({
          file: f.Location,
          lines: f.Lines,
          code: f.Code,
          complexity: f.Complexity,
        });
      }
    }
    return files.sort((a, b) => b.complexity - a.complexity);
  } catch {
    return [];
  }
}

const SOURCE_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".css",
  ".html",
]);

export async function countTokens(
  dirs: string[],
  excludeDirs: string[],
  notMatch: string[] = [],
): Promise<TokenMetrics> {
  let characters = 0, files = 0;
  const notMatchRe = notMatch.map((p) => new RegExp(p));

  async function walk(path: string) {
    for await (const entry of Deno.readDir(path)) {
      const full = `${path}/${entry.name}`;
      if (entry.isDirectory) {
        if (excludeDirs.includes(entry.name) || entry.name.startsWith(".")) {
          continue;
        }
        await walk(full);
      } else if (entry.isFile) {
        if (
          entry.name.endsWith(".min.js") || entry.name.endsWith(".min.css") ||
          entry.name.endsWith(".map")
        ) continue;
        if (notMatchRe.some((re) => re.test(entry.name))) continue;
        const ext = entry.name.substring(entry.name.lastIndexOf("."));
        if (SOURCE_EXTS.has(ext)) {
          const s = await Deno.stat(full);
          characters += s.size;
          files++;
        }
      }
    }
  }

  for (const d of dirs) await walk(d);
  const estimatedTokens = Math.round(characters / 4);
  return {
    characters,
    files,
    estimatedTokens,
    tokensPerFile: files > 0 ? Math.round(estimatedTokens / files) : 0,
  };
}

export async function countDepsPackageJson(
  dir: string,
): Promise<DependencyMetrics> {
  try {
    const pkg = JSON.parse(await Deno.readTextFile(`${dir}/package.json`));
    const prod = Object.keys(pkg.dependencies ?? {}).length;
    const dev = Object.keys(pkg.devDependencies ?? {}).length;
    return { production: prod, development: dev, total: prod + dev };
  } catch {
    return { production: 0, development: 0, total: 0 };
  }
}

export async function countDepsDenoJson(
  dir: string,
): Promise<DependencyMetrics> {
  try {
    const cfg = JSON.parse(await Deno.readTextFile(`${dir}/deno.json`));
    const imports = Object.values(cfg.imports ?? {}) as string[];
    const prod = imports.filter((v) =>
      v.startsWith("npm:") || v.startsWith("jsr:")
    ).length;
    return { production: prod, development: 0, total: prod };
  } catch {
    return { production: 0, development: 0, total: 0 };
  }
}

export async function countDeps(dir: string): Promise<DependencyMetrics> {
  try {
    await Deno.stat(`${dir}/package.json`);
    return countDepsPackageJson(dir);
  } catch {
    return countDepsDenoJson(dir);
  }
}

const CONFIG_PATTERNS = [
  /^tsconfig.*\.json$/,
  /^\.eslint/,
  /^eslint\.config/,
  /^webpack[./]/,
  /^vite\.config/,
  /^vitest.*\.config/,
  /^playwright\.config/,
  /^babel\.config/,
  /^\.babelrc/,
  /^postcss\.config/,
  /^\.prettierrc/,
  /^prettier\.config/,
  /^\.gitlab-ci\.yml$/,
  /^jest\.config/,
  /^rollup\.config/,
  /^deno\.json$/,
  /^package\.json$/,
  /^\.editorconfig$/,
  /^Containerfile$/,
  /^Dockerfile$/,
  /^template.*\.yaml$/,
];

export async function countConfigFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    for await (const entry of Deno.readDir(dir)) {
      if (entry.isDirectory && entry.name === "webpack") {
        for await (const sub of Deno.readDir(`${dir}/${entry.name}`)) {
          if (sub.isFile) count++;
        }
      } else if (
        entry.isFile && CONFIG_PATTERNS.some((p) => p.test(entry.name))
      ) {
        count++;
      }
    }
  } catch { /* dir may not exist */ }
  return count;
}

export async function countScripts(dir: string): Promise<number> {
  try {
    const pkg = JSON.parse(await Deno.readTextFile(`${dir}/package.json`));
    return Object.keys(pkg.scripts ?? {}).length;
  } catch {
    try {
      const cfg = JSON.parse(await Deno.readTextFile(`${dir}/deno.json`));
      return Object.keys(cfg.tasks ?? {}).length;
    } catch {
      return 0;
    }
  }
}

function countNewlines(src: string, start: number, end: number): number {
  let n = 0;
  for (let j = start; j < end; j++) if (src[j] === "\n") n++;
  return n;
}

function stripStringsAndTemplates(src: string): string {
  let out = "", i = 0;
  const templateDepth: number[] = [];

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (ch === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < src.length - 1 && !(src[i] === "*" && src[i + 1] === "/")) {
        i++;
      }
      i += 2;
      out += "\n".repeat(countNewlines(src, start, i));
      continue;
    }
    if (ch === "'" || ch === '"') {
      const start = i;
      i++;
      while (i < src.length && src[i] !== ch) {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
      out += '""' + "\n".repeat(countNewlines(src, start, i));
      continue;
    }
    if (ch === "`") {
      const start = i;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === "$" && src[i + 1] === "{") {
          i += 2;
          templateDepth.push(0);
          break;
        }
        if (src[i] === "`") {
          i++;
          break;
        }
        i++;
      }
      out += '""' + "\n".repeat(countNewlines(src, start, i));
      continue;
    }
    if (templateDepth.length > 0) {
      if (ch === "{") {
        templateDepth[templateDepth.length - 1]++;
        out += ch;
        i++;
        continue;
      }
      if (ch === "}") {
        if (templateDepth[templateDepth.length - 1] === 0) {
          templateDepth.pop();
          const bodyStart = i;
          i++;
          while (i < src.length) {
            if (src[i] === "\\") {
              i += 2;
              continue;
            }
            if (src[i] === "$" && src[i + 1] === "{") {
              i += 2;
              templateDepth.push(0);
              break;
            }
            if (src[i] === "`") {
              i++;
              break;
            }
            i++;
          }
          out += "\n".repeat(countNewlines(src, bodyStart, i));
          continue;
        }
        templateDepth[templateDepth.length - 1]--;
      }
    }

    out += ch;
    i++;
  }
  return out;
}

const JS_EXTS = new Set([".js", ".ts", ".jsx", ".tsx", ".mjs"]);

const KEYWORDS =
  /^(if|else|for|while|return|const|let|var|function|class|import|export|from|new|this|null|true|false|undefined|typeof|async|await|try|catch|throw|switch|case|break|default|continue|do|in|of|void|delete|instanceof|yield)$/;

export async function computeAiMetrics(
  dirs: string[],
  excludeDirs: string[],
  notMatch: string[] = [],
): Promise<AiMetrics> {
  let totalLines = 0,
    totalCode = 0,
    totalComments = 0,
    totalFunctions = 0;
  let totalFunctionLines = 0,
    maxNesting = 0,
    totalConditionals = 0;
  let totalNameLen = 0,
    nameCount = 0,
    totalCognitive = 0;
  let fileCount = 0,
    fanOutFiles = 0,
    fanOutChars = 0;
  let directChars = 0;
  const importedPaths = new Set<string>();
  const notMatchRe = notMatch.map((p) => new RegExp(p));

  async function processFile(path: string) {
    const ext = path.substring(path.lastIndexOf("."));
    if (!JS_EXTS.has(ext)) return;

    let content: string;
    try {
      content = await Deno.readTextFile(path);
    } catch {
      return;
    }
    fileCount++;
    directChars += content.length;

    const lines = content.split("\n");
    totalLines += lines.length;

    const stripped = stripStringsAndTemplates(content);
    const strippedLines = stripped.split("\n");

    let inFunction = false, funcLines = 0, nesting = 0, maxFileNesting = 0;

    for (let li = 0; li < lines.length; li++) {
      const trimmed = lines[li].trim();
      const strippedTrimmed = (strippedLines[li] ?? "").trim();
      if (!trimmed) continue;

      if (/^\s*(\/\/|\/\*|\*)/.test(lines[li])) {
        totalComments++;
        continue;
      }
      totalCode++;

      const condMatches = strippedTrimmed.match(/\b(if|else|switch|case)\b/g);
      if (condMatches) totalConditionals += condMatches.length;
      const logicalOps = strippedTrimmed.match(/&&|\|\||\?(?![?.])/g);
      if (logicalOps) totalConditionals += logicalOps.length;

      const opens = (strippedTrimmed.match(/{/g) || []).length;
      const closes = (strippedTrimmed.match(/}/g) || []).length;
      nesting += opens - closes;
      if (nesting < 0) nesting = 0;
      if (nesting > maxFileNesting) maxFileNesting = nesting;

      if (/\b(if|for|while|switch)\b/.test(strippedTrimmed)) {
        totalCognitive += 1 + Math.max(0, nesting - 1);
      }

      if (
        /\b(function\s|=>|async\s+(function|[a-zA-Z]))/.test(strippedTrimmed) ||
        /^\s*(get|set)\s+\w/.test(strippedTrimmed)
      ) {
        totalFunctions++;
        inFunction = true;
        funcLines = 0;
      }
      if (inFunction) {
        funcLines++;
        if (closes > opens || funcLines > 200) {
          totalFunctionLines += funcLines;
          inFunction = false;
        }
      }

      const ids = strippedTrimmed.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g);
      if (ids) {
        for (const id of ids) {
          if (id.length < 2 || KEYWORDS.test(id)) continue;
          totalNameLen += id.length;
          nameCount++;
        }
      }

      const importMatch = trimmed.match(/from\s+["']([^"']+)["']/);
      if (importMatch && importMatch[1].startsWith(".")) {
        importedPaths.add(importMatch[1]);
      }
    }

    if (maxFileNesting > maxNesting) maxNesting = maxFileNesting;
  }

  async function walk(path: string) {
    for await (const entry of Deno.readDir(path)) {
      const full = `${path}/${entry.name}`;
      if (entry.isDirectory) {
        if (excludeDirs.includes(entry.name) || entry.name.startsWith(".")) {
          continue;
        }
        await walk(full);
      } else if (entry.isFile) {
        if (
          entry.name.endsWith(".min.js") || entry.name.endsWith(".min.css") ||
          entry.name.endsWith(".map")
        ) continue;
        if (notMatchRe.some((re) => re.test(entry.name))) continue;
        await processFile(full);
      }
    }
  }

  for (const d of dirs) await walk(d);

  fanOutFiles = importedPaths.size;
  fanOutChars = Math.round(directChars * 0.3);

  const directTokens = Math.round(directChars / 4);
  const fanOutTokens = Math.round(fanOutChars / 4);

  const avgFuncLen = totalFunctions > 0
    ? totalFunctionLines / totalFunctions
    : 0;
  const funcLenScore = Math.max(0, 100 - Math.max(0, avgFuncLen - 10) * 3);
  const commentDensity = totalLines > 0 ? totalComments / totalLines : 0;
  const commentScore = commentDensity >= 0.08 && commentDensity <= 0.15
    ? 100
    : Math.max(0, 100 - Math.abs(commentDensity - 0.12) * 400);
  const fileCountScore = Math.max(
    0,
    Math.min(100, 100 - Math.max(0, fileCount - 15) * 0.7),
  );
  const avgNameLen = nameCount > 0 ? totalNameLen / nameCount : 0;
  const namingScore = avgNameLen >= 4 && avgNameLen <= 20
    ? 100
    : Math.max(0, 100 - Math.abs(avgNameLen - 12) * 5);
  const ccPerFunc = totalFunctions > 0 ? totalCognitive / totalFunctions : 0;
  const ccScore = Math.max(0, 100 - ccPerFunc * 10);
  const codeRatio = totalLines > 0 ? totalCode / totalLines : 1;
  const codeRatioScore = Math.min(100, codeRatio * 120);

  const codeHealth = Math.round(
    funcLenScore * 0.20 +
      commentScore * 0.10 +
      fileCountScore * 0.10 +
      namingScore * 0.15 +
      ccScore * 0.20 +
      codeRatioScore * 0.10 +
      Math.min(100, Math.max(0, 100 - totalCode / 200)) * 0.15,
  );

  const conditionalDensity = totalCode > 0
    ? (totalConditionals / totalCode) * 100
    : 0;
  const nestingClarity = Math.max(
    0,
    100 - Math.pow(Math.max(0, maxNesting - 4), 1.5) * 3,
  );
  const condClarity = Math.max(0, 100 - conditionalDensity * 5);
  const funcLenClarity = Math.max(
    0,
    100 - Math.max(0, avgFuncLen - 5) * 3,
  );
  const commentClarity = commentDensity >= 0.08 && commentDensity <= 0.20
    ? 100
    : Math.max(0, 100 - Math.abs(commentDensity - 0.12) * 500);

  const clarity = Math.round(
    nestingClarity * 0.25 +
      condClarity * 0.20 +
      namingScore * 0.20 +
      funcLenClarity * 0.15 +
      commentClarity * 0.10 +
      Math.min(100, Math.max(0, 100 - fileCount * 1.5)) * 0.10,
  );

  return {
    codeHealth: Math.min(100, Math.max(0, codeHealth)),
    tokenFanOut: {
      direct: directTokens,
      fanOut: fanOutTokens,
      total: directTokens + fanOutTokens,
      fanOutFiles,
    },
    clarity: Math.min(100, Math.max(0, clarity)),
    cognitiveComplexity: totalCognitive,
    details: {
      avgFunctionLength: Math.round(avgFuncLen),
      maxNestingDepth: maxNesting,
      commentDensity: Math.round(commentDensity * 1000) / 10,
      namingScore: Math.round(namingScore),
      conditionalDensity: Math.round(conditionalDensity * 10) / 10,
      condDensityPerFunction: totalFunctions > 0
        ? Math.round((totalConditionals / totalFunctions) * 10) / 10
        : 0,
    },
  };
}

export function cocomo(kloc: number): CocomoMetrics {
  const effort = 2.4 * Math.pow(kloc, 1.05);
  const schedule = 2.5 * Math.pow(effort, 0.38);
  return {
    effortMonths: Math.round(effort * 10) / 10,
    scheduleMonths: Math.round(schedule * 100) / 100,
    estimatedCost: Math.round(effort * 56286),
  };
}

export function sccTotals(data: SccLanguage[]): SccTotals {
  return data.reduce(
    (a, l) => ({
      files: a.files + l.Count,
      lines: a.lines + l.Lines,
      code: a.code + l.Code,
      complexity: a.complexity + l.Complexity,
      comments: a.comments + l.Comment,
    }),
    { files: 0, lines: 0, code: 0, complexity: 0, comments: 0 },
  );
}

export function sccBreakdown(data: SccLanguage[]): Record<
  string,
  {
    files: number;
    lines: number;
    code: number;
    complexity: number;
    comments: number;
  }
> {
  return Object.fromEntries(
    data.map((l) => [l.Name, {
      files: l.Count,
      lines: l.Lines,
      code: l.Code,
      complexity: l.Complexity,
      comments: l.Comment,
    }]),
  );
}
