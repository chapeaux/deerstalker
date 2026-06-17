# Tweed

A codebase comparison tool that measures two folders across code metrics,
complexity, dependencies, AI-friendliness, token economy, and cost estimates.
Outputs JSON, HTML, and Markdown reports. Uses
[scc](https://github.com/boyter/scc) for code analysis and
[Beret](https://github.com/chapeaux/beret) for structural AST analysis.

## Installation

### Download a release (recommended)

Download a prebuilt binary from
[Releases](https://github.com/chapeaux/deerstalker/releases) for your platform:

| Platform            | File                         |
| ------------------- | ---------------------------- |
| Linux x86_64        | `tweed-linux-x86_64.tar.gz`  |
| Linux aarch64       | `tweed-linux-aarch64.tar.gz` |
| macOS x86_64        | `tweed-macos-x86_64.tar.gz`  |
| macOS Apple Silicon | `tweed-macos-aarch64.tar.gz` |
| Windows x86_64      | `tweed-windows-x86_64.zip`   |

Extract and move to somewhere on your PATH:

```sh
tar xzf tweed-linux-x86_64.tar.gz
sudo mv tweed-linux-x86_64 /usr/local/bin/tweed
```

On first run, tweed will download `scc` and `beret` to `~/.tweed/bin/` if they
aren't already installed. No other dependencies are required.

### Deno install (from source)

```sh
git clone https://github.com/chapeaux/deerstalker.git
cd deerstalker
deno install -g -A --name tweed --config deno.json main.ts
```

### Compile from source

```sh
git clone https://github.com/chapeaux/deerstalker.git
cd deerstalker
deno task compile    # produces a ./tweed binary
```

### Run without installing

```sh
deno run -A main.ts <folder-a> <folder-b>
```

Requires [Deno](https://deno.land) 2.8+.

## Usage

```sh
tweed <folder-a> <folder-b> [options]
```

### Options

| Flag                  | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `--label-a <name>`    | Label for folder A (default: directory name)               |
| `--label-b <name>`    | Label for folder B (default: directory name)               |
| `-o, --output <dir>`  | Output directory (default: `./tweed-output`)               |
| `-f, --format <list>` | Comma-separated: `json`, `html`, `md` (default: all three) |
| `--exclude-a <dirs>`  | Comma-separated dirs to additionally exclude from A        |
| `--exclude-b <dirs>`  | Comma-separated dirs to additionally exclude from B        |
| `--src-a <subdirs>`   | Source subdirs within A (default: A root)                  |
| `--src-b <subdirs>`   | Source subdirs within B (default: B root)                  |
| `--json`              | Also print JSON to stdout                                  |
| `--no-beret`          | Skip Beret structural analysis                             |
| `--serve [port]`      | Start web server to view reports (default port: 3000)      |
| `--watch`             | Watch both folders for changes and reassess automatically  |
| `--glossary`          | Print explanations of all metrics and exit                 |
| `--help`              | Show help                                                  |

### Examples

Compare two projects with custom labels:

```sh
tweed ./app-v1 ./app-v2 --label-a "Version 1" --label-b "Version 2"
```

Compare only the `src/` directory of one project against another:

```sh
tweed ./legacy-app ./new-app --src-a src --label-a "Legacy" --label-b "Rewrite"
```

Live dashboard with auto-refresh on changes:

```sh
tweed ./before ./after --serve --watch
```

Exclude additional directories:

```sh
tweed ./project-a ./project-b --exclude-a test,fixtures --exclude-b __tests__,mocks
```

## Output formats

### HTML (`comparison.html`)

A dark-mode dashboard with:

- Summary cards showing percentage changes for the headline metrics
- Comparison table with visual diff bars for every metric
- Hover tooltips on each metric name explaining what it is, how it's calculated,
  and what it means
- Language breakdown showing file counts and code lines per language
- Complexity hotspots listing the top 10 files by cyclomatic complexity in each
  folder

### Markdown (`comparison.md`)

A portable Markdown report with:

- Summary table and per-section breakdowns
- Change direction annotations (better/worse) on each row
- A full glossary at the bottom explaining every metric

### JSON (`comparison.json`)

Machine-readable structured data containing all metrics for both folders and the
comparison rows. Suitable for piping into other tools, dashboards, or CI
reporting.

## What gets compared

Tweed collects metrics from two sources: **scc** for code-level analysis and
**Beret** for structural AST analysis.

### Code Size

| Metric        | What it tells you                                                        |
| ------------- | ------------------------------------------------------------------------ |
| Source files  | Total file count. Fewer files means less to navigate.                    |
| Lines of code | Code lines (excluding blanks and comments). The most basic size measure. |
| Comments      | Comment line count. 8-15% of total lines is a healthy range.             |

### Complexity

| Metric                    | What it tells you                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Cyclomatic complexity     | Number of independent execution paths. Under 10 per function is ideal; over 20 is a red flag. Reported as a codebase-wide sum.      |
| Cognitive complexity      | How hard the code is for a human to read. Penalizes nesting -- three levels of nested `if` scores much higher than three flat ones. |
| Max nesting depth         | Deepest brace nesting in any file. 6+ is a warning sign for readability.                                                            |
| Avg function length       | Average lines per function. Under 15 is easy to test; 30+ suggests functions doing too much.                                        |
| Conditional density       | Conditionals per 100 LOC (`if`, `else`, `switch`, `case`, `&&`, `\|\|`, `?`). Under 5 is clean, 10-20 is dense.                     |
| Conditionals per function | Average conditionals per function. Over 8 suggests decomposition is needed.                                                         |

### Dependencies & Config

| Metric             | What it tells you                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Dependencies       | Total declared packages. Each one is supply chain risk and maintenance burden.           |
| Production deps    | Packages that ship to users -- affects bundle size and attack surface.                   |
| Dev deps           | Build tools, test frameworks, linters. Affects onboarding time and CI speed.             |
| Config files       | Count of tool configs (tsconfig, eslint, webpack, etc.). Each one is cognitive overhead. |
| Build/task scripts | Number of npm scripts or deno tasks. More scripts = more complex build pipeline.         |

### AI Friendliness

| Metric               | What it tells you                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| CodeHealth (0-100)   | Weighted composite of function length, naming, nesting, comments, and size. 80+ is excellent, under 60 needs attention. |
| LLM Clarity (0-100)  | How easily AI tools can understand the code. Flat, well-named, short-function code scores highest.                      |
| Naming score (0-100) | Identifier quality based on average name length. 4-20 characters is ideal.                                              |
| Comment density (%)  | Percentage of lines that are comments. Sweet spot is 8-15%.                                                             |

### Token Economy

| Metric                | What it tells you                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| LLM context tokens    | Estimated tokens to read all source files. Compare against your model's context window (100K-1M tokens). |
| Tokens per file       | Average tokens per file. Very high (5000+) suggests monolithic files.                                    |
| Direct tokens         | Token count of the source files themselves.                                                              |
| Fan-out tokens        | Estimated additional tokens from local imports (~30% of direct).                                         |
| Context fan-out total | Direct + fan-out. The true cost of loading the codebase into an LLM.                                     |
| Fan-out files         | Count of locally-imported files. High fan-out means each file drags in more context.                     |

### COCOMO Estimates

| Metric             | What it tells you                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Estimated cost ($) | COCOMO Basic model estimate of development cost at $56,286/person-month. Useful for _relative_ comparison, not budgeting. |
| Schedule (months)  | COCOMO timeline estimate. Again, relative -- not a planning tool.                                                         |

### Structural Analysis (Beret)

| Metric              | What it tells you                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Functions           | Function/method count via AST parsing (17 languages).                                          |
| Classes             | Class, struct, interface, and type definitions.                                                |
| Test functions      | Tests detected via annotations or file paths.                                                  |
| Test ratio (%)      | Test functions / total functions. 20%+ suggests good coverage; under 5% suggests undertesting. |
| Architecture layers | Structural layers detected from directory names (source, tests, api, ui, services, etc.).      |

## Reading the results

### The comparison is directional

Tweed compares folder A against folder B. The "reduction" column shows the
percentage change from A to B. If you're comparing an old codebase (A) against a
rewrite (B), negative reductions mean B is larger/more complex in that
dimension.

Not every metric improving is realistic. A rewrite might have higher cognitive
complexity in exchange for dramatically fewer files and dependencies. Read the
report as a whole, not as a scorecard where every row must be green.

### When "better" depends on context

- **Comment density** -- 0% isn't good (undocumented), but 30% isn't either
  (code can't speak for itself). The tool flags 8-15% as healthy.
- **Tokens per file** -- Very low (under 100) can mean over-decomposition. Very
  high (5000+) can mean monolithic files. Neither extreme is ideal.
- **Cognitive complexity increasing while cyclomatic decreases** -- This happens
  when code is consolidated into fewer, slightly more complex functions. Whether
  that's a net improvement depends on whether the consolidation makes the
  codebase easier to navigate overall.
- **COCOMO estimates** -- These are order-of-magnitude estimates based on lines
  of code. They're useful for comparing two codebases against each other but
  should not be used for actual project budgeting.

### Metrics that can be misleading

- **Lines of code** counts everything scc finds, including CSS, YAML, HTML,
  Markdown, and SVGs. If one folder has extensive documentation or large CSS
  files, the LOC comparison may overstate the difference in actual application
  logic. Use `--src-a` / `--src-b` to scope to source directories, or
  `--exclude-a` / `--exclude-b` to filter out non-code.
- **Cyclomatic complexity** is a sum across the entire codebase. A folder with
  more files will naturally have a higher total. Per-file hotspots (the bottom
  of the report) are often more actionable.
- **Fan-out tokens** use a 30% heuristic for import expansion. This is a rough
  estimate -- projects with deep import trees may undercount, and flat projects
  may overcount.
- **Test ratio** counts test functions vs total functions, not line or branch
  coverage. A project can have many test functions with shallow assertions and
  still have poor coverage.

## Default exclusions

Tweed automatically excludes these directories from both folders:

`node_modules`, `.git`, `dist`, `build`, `.deno`, `vendor`, `coverage`, `.next`,
`.nuxt`, `__pycache__`, `.cache`, `target`, `.parcel-cache`, `.svelte-kit`,
`.output`, `.turbo`, `tweed-output`

The `--exclude-a` and `--exclude-b` flags add to these defaults. If a folder has
additional generated or vendored content (e.g., `lib/vendor/`, `third_party/`),
exclude it to avoid inflated numbers.

## Common pitfalls

### Inflated numbers from vendored code

If a project vendors its dependencies (copies them into the repo instead of
installing them), they'll be counted as source code. This is the most common
cause of "impossible" numbers like 30,000 functions in a small project. Use
`--exclude-a`/`--exclude-b` to skip vendor directories, or `--src-a`/`--src-b`
to point at just the source code.

### Comparing projects with different structures

If one project keeps source in `src/` and the other keeps it at the root
alongside docs, configs, and assets, the root-level project will show inflated
code metrics. Use `--src-a`/`--src-b` to normalize:

```sh
tweed ./react-app ./deno-app --src-a src
```

### Lock files and generated code

Large generated files (`deno.lock`, `package-lock.json`, generated API clients)
are typically in excluded directories, but if they live at the project root,
they can inflate scc and Beret counts. Exclude them:

```sh
tweed ./app-a ./app-b --exclude-b generated
```

### Monorepos

For monorepos, point `--src-a` / `--src-b` at the specific package you want to
compare, not the monorepo root:

```sh
tweed ./monorepo-a ./monorepo-b --src-a packages/core --src-b packages/core
```

## Dependencies

Tweed uses two external tools. Both are downloaded automatically to
`~/.tweed/bin/` on first run if not already on PATH.

| Tool                                              | Purpose                                            | Source           |
| ------------------------------------------------- | -------------------------------------------------- | ---------------- |
| [scc](https://github.com/boyter/scc) v3.7.0       | Code metrics, complexity, language detection       | `boyter/scc`     |
| [Beret](https://github.com/chapeaux/beret) v0.3.3 | AST structural analysis, dead code, test detection | `chapeaux/beret` |

Beret is optional -- if unavailable, structural analysis sections are omitted
from reports. scc is required.

## Architecture

```
deerstalker/
  main.ts              CLI entry point, arg parsing, orchestration
  deno.json            Tasks and compiler options
  lib/
    types.ts           Shared TypeScript interfaces
    metrics.ts         scc runner, token counter, AI metrics, COCOMO
    beret.ts           Beret CLI integration
    glossary.ts        Metric explanations (drives tooltips, glossary, --glossary)
    deps.ts            Auto-download of scc and beret
    report-html.ts     HTML dashboard generator
    report-md.ts       Markdown report generator
    server.ts          Dev server for --serve with SSE live reload
    watcher.ts         File watcher for --watch with debouncing
```

## Releasing

Releases are triggered by pushing a version tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The GitHub Actions workflow compiles binaries for all five supported platforms
and creates a GitHub release with the archives attached. Release notes are
auto-generated from commits since the previous tag.

## License

MIT -- see [LICENSE](LICENSE).

Third-party dependency licenses are documented in
[THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md). All dependencies (scc,
Beret, Deno runtime) are MIT-licensed.
