export interface SccLanguage {
  Name: string;
  Count: number;
  Lines: number;
  Code: number;
  Comment: number;
  Blank: number;
  Complexity: number;
  Bytes: number;
}

export interface SccFile {
  Location: string;
  Lines: number;
  Code: number;
  Complexity: number;
  Comment: number;
  Blank: number;
}

export interface FileMetric {
  file: string;
  lines: number;
  code: number;
  complexity: number;
}

export interface AiMetrics {
  codeHealth: number;
  tokenFanOut: {
    direct: number;
    fanOut: number;
    total: number;
    fanOutFiles: number;
  };
  clarity: number;
  cognitiveComplexity: number;
  details: {
    avgFunctionLength: number;
    maxNestingDepth: number;
    commentDensity: number;
    namingScore: number;
    conditionalDensity: number;
    condDensityPerFunction: number;
  };
}

export interface TokenMetrics {
  characters: number;
  files: number;
  estimatedTokens: number;
  tokensPerFile: number;
}

export interface DependencyMetrics {
  production: number;
  development: number;
  total: number;
}

export interface CocomoMetrics {
  effortMonths: number;
  scheduleMonths: number;
  estimatedCost: number;
}

export interface SccTotals {
  files: number;
  lines: number;
  code: number;
  complexity: number;
  comments: number;
}

export interface BeretArchitecture {
  layers: string[];
  is_monorepo: boolean;
  counts: {
    functions: number;
    classes: number;
    config_files: number;
    documents: number;
    binary_assets: number;
  };
  package_managers: string[];
}

export interface BeretTesting {
  frameworks: string[];
  test_functions: number;
  total_functions: number;
  test_ratio_percent: number;
}

export interface BeretActivity {
  contributors: Array<{ name: string; commits: number }>;
  most_active_files: Array<{ file: string; commits: number }>;
  total_commits?: number;
}

export interface BeretData {
  architecture: BeretArchitecture;
  testing: BeretTesting;
  activity: BeretActivity;
  insights?: string[];
}

export interface FolderReport {
  label: string;
  path: string;
  scc: Record<
    string,
    {
      files: number;
      lines: number;
      code: number;
      complexity: number;
      comments: number;
    }
  >;
  totals: SccTotals;
  tokens: TokenMetrics;
  dependencies: DependencyMetrics;
  configFiles: number;
  scripts: number;
  cocomo: CocomoMetrics;
  topFiles: FileMetric[];
  ai: AiMetrics;
  beret?: BeretData;
}

export interface ComparisonRow {
  label: string;
  a: number;
  b: number;
  reduction: string;
}

export interface FullReport {
  timestamp: string;
  folderA: FolderReport;
  folderB?: FolderReport;
  comparison?: ComparisonRow[];
}
