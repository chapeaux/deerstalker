import type { BeretArchitecture, BeretData, BeretTesting } from "./types.ts";

export let BERET_BIN = "beret";

export function setBeretBin(path: string) {
  BERET_BIN = path;
}

async function runBeret(
  command: string,
  path: string,
  excludes: string[] = [],
): Promise<Record<string, unknown> | null> {
  try {
    const args = [command];
    for (const ex of excludes) {
      args.push("--exclude", ex);
    }
    args.push(path);
    const { stdout, success } = await new Deno.Command(BERET_BIN, {
      args,
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!success) return null;
    return JSON.parse(new TextDecoder().decode(stdout));
  } catch {
    return null;
  }
}

export async function collectBeretData(
  path: string,
  excludes: string[] = [],
): Promise<BeretData | undefined> {
  const [archResult, testResult, descResult] = await Promise.all([
    runBeret("architecture", path, excludes),
    runBeret("testing", path, excludes),
    runBeret("describe", path, excludes),
  ]);

  if (!archResult && !testResult) return undefined;

  const architecture: BeretArchitecture = archResult
    ? archResult as unknown as BeretArchitecture
    : {
      layers: [],
      is_monorepo: false,
      counts: {
        functions: 0,
        classes: 0,
        config_files: 0,
        documents: 0,
        binary_assets: 0,
      },
      package_managers: [],
    };

  const testing: BeretTesting = testResult
    ? testResult as unknown as BeretTesting
    : {
      frameworks: [],
      test_functions: 0,
      total_functions: 0,
      test_ratio_percent: 0,
    };

  const activity = descResult?.activity
    ? descResult.activity as BeretData["activity"]
    : { contributors: [], most_active_files: [] };

  const insights = descResult?.insights as string[] | undefined;

  return { architecture, testing, activity, insights };
}
