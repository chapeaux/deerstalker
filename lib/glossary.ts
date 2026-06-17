export interface MetricEntry {
  name: string;
  short: string;
  calc: string;
  meaning: string;
}

export const GLOSSARY: MetricEntry[] = [
  // Code Size
  {
    name: "Source files",
    short: "Number of source files analyzed.",
    calc:
      "Count of all files detected by scc (excluding binary assets and excluded directories).",
    meaning:
      "Fewer files generally means less to navigate, review, and maintain. A large file count can indicate over-decomposition or boilerplate.",
  },
  {
    name: "Lines of code",
    short: "Lines containing actual code (not blanks or comments).",
    calc:
      "Counted by scc, which strips blank lines and comment-only lines from the total.",
    meaning:
      "The most basic measure of codebase size. Less code means less to read, test, and debug — but only if functionality is preserved.",
  },
  {
    name: "Comments",
    short: "Lines that are comments.",
    calc:
      "Counted by scc — includes line comments (//) and block comments (/* */).",
    meaning:
      "Comments aid understanding but can become stale. A moderate ratio (8-15% of lines) is healthy; too few suggests under-documented code, too many can indicate unclear code that needs explaining.",
  },

  // Complexity
  {
    name: "Cyclomatic complexity",
    short: "Number of independent execution paths through the code.",
    calc:
      "Counted by scc. Each branch point (if, else, case, for, while, catch, &&, ||) adds one path. A function with no branches has complexity 1.",
    meaning:
      "Higher values mean more paths to test and more potential for bugs. Under 10 per function is ideal; over 20 is a red flag. This is the sum across the entire codebase.",
  },
  {
    name: "Cognitive complexity",
    short: "How hard the code is for a human to understand.",
    calc:
      "Each branching statement (if, for, while, switch) scores 1 + (nesting depth - 1). Deeply nested branches score much higher than flat ones. Computed from stripped source (string literals and template bodies removed to avoid false positives).",
    meaning:
      "Unlike cyclomatic complexity, this penalizes nesting. A flat chain of if/else is easier to follow than three levels of nested conditionals, and the score reflects that. Lower is more readable.",
  },
  {
    name: "Max nesting depth",
    short: "Deepest level of brace nesting found in any file.",
    calc:
      "Tracks opening/closing braces in stripped source code (with string/template literal bodies removed). Reports the highest depth reached across all files.",
    meaning:
      "Deep nesting (6+) makes code hard to follow and is a common source of bugs. Refactoring into early returns or extracted functions can flatten it.",
  },
  {
    name: "Avg function length",
    short: "Average number of code lines per function.",
    calc:
      "Total lines inside functions divided by total function count. Functions are detected by pattern matching (function keyword, arrow functions, async functions, getters/setters).",
    meaning:
      "Shorter functions (under 15 lines) are easier to understand, test, and reuse. Long functions (30+) often do too many things and should be split.",
  },
  {
    name: "Conditional density (/100 LOC)",
    short: "How many conditionals per 100 lines of code.",
    calc:
      "Count of if, else, switch, case, &&, ||, and ternary (?) operators, divided by lines of code, times 100.",
    meaning:
      "High density (15+) means the code is heavily branching — hard to read and test. Under 5 is clean, 5-10 is normal, 10-20 is dense.",
  },
  {
    name: "Conditionals per function",
    short: "Average number of conditionals in each function.",
    calc: "Total conditional count divided by total function count.",
    meaning:
      "A function with many conditionals is doing a lot of decision-making. Under 3 is clean; over 8 suggests the function should be decomposed.",
  },

  // Dependencies & Config
  {
    name: "Dependencies",
    short: "Total declared package dependencies.",
    calc:
      "Sum of production and development dependencies from package.json (npm) or deno.json imports (Deno). Does not count transitive dependencies.",
    meaning:
      "Each dependency is code you inherit but don't control. More dependencies mean more supply chain risk, larger install sizes, and more potential breaking changes on updates.",
  },
  {
    name: "Production deps",
    short: "Packages needed at runtime.",
    calc:
      'Count of entries in package.json "dependencies" or npm:/jsr: imports in deno.json.',
    meaning:
      "These ship to users and affect bundle size, startup time, and attack surface. Every production dependency should earn its place.",
  },
  {
    name: "Dev deps",
    short: "Packages needed only for development.",
    calc: 'Count of entries in package.json "devDependencies".',
    meaning:
      "Build tools, test frameworks, and linters. These don't ship to users but still affect developer onboarding time and CI speed.",
  },
  {
    name: "Config files",
    short: "Number of tool configuration files in the project root.",
    calc:
      "Pattern-matches filenames against 20 known config patterns (tsconfig, eslint, webpack, vite, vitest, playwright, babel, postcss, prettier, Dockerfile, etc.). Includes files in a webpack/ subdirectory.",
    meaning:
      "Each config file is something a developer must understand. Fewer configs means simpler tooling and faster onboarding.",
  },
  {
    name: "Build/task scripts",
    short: "Number of defined build/task scripts.",
    calc: 'Count of entries in package.json "scripts" or deno.json "tasks".',
    meaning:
      "More scripts can indicate a complex build pipeline. A project with 5 tasks is faster to learn than one with 30.",
  },

  // AI Friendliness
  {
    name: "CodeHealth score (0-100)",
    short:
      "Composite score of how maintainable and well-structured the code is.",
    calc:
      "Weighted average of: function length (20%), cognitive complexity per function (20%), naming quality (15%), total code size (15%), comment density (10%), file count (10%), code-to-LOC ratio (10%). Each factor is scored 0-100 and combined.",
    meaning:
      "A quick health check. 80+ is excellent, 60-80 is healthy, under 60 suggests maintenance challenges. Use the component scores to identify specific areas for improvement.",
  },
  {
    name: "LLM Clarity (0-100)",
    short:
      "How easily an AI language model can understand and work with this code.",
    calc:
      "Weighted average of: nesting clarity (25%), conditional density (20%), naming quality (20%), function length (15%), comment clarity (10%), file count (10%).",
    meaning:
      "Higher scores mean AI tools (code completion, chat, refactoring) will produce more accurate results. Flat, well-named, moderately-commented code with short functions scores highest.",
  },
  {
    name: "Naming score (0-100)",
    short: "Quality of identifier names.",
    calc:
      "Based on average identifier length. Names between 4-20 characters score 100 (descriptive but not verbose). Very short (x, i) or very long names are penalized. Keywords and 1-character names are excluded.",
    meaning:
      "Good names are the best documentation. A high score means developers (and AI tools) can understand the code from the identifiers alone.",
  },
  {
    name: "Comment density (%)",
    short: "Percentage of lines that are comments.",
    calc: "Comment lines divided by total lines, times 100.",
    meaning:
      "8-15% is the sweet spot: enough to explain non-obvious decisions, not so much that comments crowd out code. 0% means no documentation; 30%+ suggests the code can't speak for itself.",
  },

  // Token Economy
  {
    name: "LLM context tokens",
    short: "Estimated tokens an LLM needs to read all source files.",
    calc:
      "Total characters in source files (.ts, .tsx, .js, .jsx, .mjs, .css, .html) divided by 4. Excludes minified files and source maps.",
    meaning:
      "LLMs have context window limits (typically 100K-1M tokens). A codebase that fits in one context window can be fully understood by AI; one that doesn't requires chunking and loses cross-file understanding.",
  },
  {
    name: "Tokens per file",
    short: "Average token count per source file.",
    calc: "Total estimated tokens divided by file count.",
    meaning:
      "Measures file granularity. Very high values (5000+) suggest monolithic files; very low values (under 100) suggest over-decomposition. 500-2000 is typical for well-structured projects.",
  },
  {
    name: "Direct tokens",
    short: "Tokens in the source files themselves.",
    calc: "Characters in all JS/TS/CSS/HTML source files divided by 4.",
    meaning:
      "The baseline token cost to read the codebase. This is what you'd paste into an LLM prompt.",
  },
  {
    name: "Fan-out tokens",
    short: "Estimated additional tokens from imported local modules.",
    calc:
      "Approximated as 30% of direct tokens. Based on the heuristic that local imports expand the effective context by about a third.",
    meaning:
      "When an LLM reads a file, it also needs the files that file imports. Fan-out measures this hidden context cost. Higher fan-out means each file drags in more context.",
  },
  {
    name: "Context fan-out total",
    short: "Total tokens including import fan-out.",
    calc: "Direct tokens + fan-out tokens.",
    meaning:
      "The true cost of loading the codebase into an LLM context. Compare this to your model's context window to know if it can see the whole project at once.",
  },
  {
    name: "Fan-out files",
    short: "Number of locally-imported files.",
    calc:
      'Count of unique relative import paths (starting with "./") found across all source files.',
    meaning:
      "High fan-out (many imports per file) creates a web of dependencies that's hard to understand in isolation. Lower is simpler.",
  },

  // COCOMO
  {
    name: "Estimated cost ($)",
    short: "Estimated development cost using the COCOMO model.",
    calc:
      "COCOMO Basic: effort = 2.4 * (KLOC ^ 1.05) person-months, then multiplied by $56,286/month (US average fully-loaded software engineer cost).",
    meaning:
      "A rough order-of-magnitude estimate of what it would cost to build this codebase from scratch. Useful for comparing relative effort between two codebases, not for actual budgeting.",
  },
  {
    name: "Schedule (months)",
    short: "Estimated development timeline using the COCOMO model.",
    calc: "COCOMO Basic: schedule = 2.5 * (effort ^ 0.38) months.",
    meaning:
      "How long the project would take with an average-sized team. Like the cost estimate, it's a relative measure — useful for comparing two codebases, not for planning.",
  },

  // Beret Structural Analysis
  {
    name: "Functions",
    short: "Number of function/method definitions found by AST analysis.",
    calc:
      "Beret parses source files using tree-sitter AST grammars for 17 languages and counts function, method, and constructor definitions.",
    meaning:
      "A structural count of the codebase's functional units. Compare with scc's file count to understand decomposition style.",
  },
  {
    name: "Classes",
    short: "Number of class, struct, interface, and type definitions.",
    calc:
      "Beret counts class, struct, interface, trait, enum, and module definitions via AST analysis.",
    meaning:
      "Indicates the object-oriented or type-level structure of the codebase. A high class-to-function ratio suggests heavy OOP; low suggests a more functional style.",
  },
  {
    name: "Test functions",
    short: "Number of test functions detected.",
    calc:
      "Beret detects tests via annotations (@Test, [Fact], etc.) and by file path (files in /test/, /tests/, /__tests__/, /spec/ directories).",
    meaning:
      "More test functions means better coverage potential. Compare with total functions to get the test ratio.",
  },
  {
    name: "Test ratio (%)",
    short: "Percentage of functions that are tests.",
    calc: "Test function count divided by total function count, times 100.",
    meaning:
      "A rough proxy for test coverage. 20%+ suggests good testing discipline; under 5% suggests the codebase is undertested. Note: this measures test presence, not coverage depth.",
  },
  {
    name: "Architecture layers",
    short: "Structural layers detected in the project layout.",
    calc:
      "Beret identifies layers from directory names: src/ (source), tests/ (tests), api/ (api), components/ (ui), lib/ (utilities), services/ (services), deploy/ (infrastructure), etc.",
    meaning:
      "Well-layered architecture separates concerns and makes the codebase navigable. More layers isn't always better — what matters is that the layers match the domain.",
  },
];

export function getMetricEntry(name: string): MetricEntry | undefined {
  return GLOSSARY.find((e) => e.name === name);
}

export function getTooltip(name: string): string {
  const entry = getMetricEntry(name);
  return entry ? `${entry.short} ${entry.calc}` : "";
}
