const TWEED_BIN = `${homeDir()}/.tweed/bin`;

const SCC_VERSION = "v3.7.0";
const BERET_VERSION = "v0.3.3";

function homeDir(): string {
  return Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
}

function platform(): { os: string; arch: string } {
  const os = Deno.build.os;
  const arch = Deno.build.arch;
  return { os, arch };
}

function sccAssetName(): string {
  const { os, arch } = platform();
  const osMap: Record<string, string> = {
    linux: "Linux",
    darwin: "Darwin",
    windows: "Windows",
  };
  const archMap: Record<string, string> = {
    x86_64: "x86_64",
    aarch64: "arm64",
  };
  const osName = osMap[os];
  const archName = archMap[arch];
  if (!osName || !archName) {
    throw new Error(`Unsupported platform: ${os}/${arch}`);
  }
  const ext = os === "windows" ? "zip" : "tar.gz";
  return `scc_${osName}_${archName}.${ext}`;
}

function beretAssetName(): string {
  const { os, arch } = platform();
  const targetMap: Record<string, Record<string, string>> = {
    linux: {
      x86_64: "x86_64-unknown-linux-gnu",
      aarch64: "aarch64-unknown-linux-gnu",
    },
    darwin: {
      x86_64: "x86_64-apple-darwin",
      aarch64: "aarch64-apple-darwin",
    },
    windows: {
      x86_64: "x86_64-pc-windows-msvc",
    },
  };
  const target = targetMap[os]?.[arch];
  if (!target) {
    throw new Error(`Unsupported platform: ${os}/${arch}`);
  }
  const ext = os === "windows" ? "zip" : "tar.gz";
  return `beret-${BERET_VERSION}-${target}.${ext}`;
}

async function commandExists(name: string): Promise<string | null> {
  const paths = [
    name,
    `${TWEED_BIN}/${name}`,
    `${TWEED_BIN}/${name}${Deno.build.os === "windows" ? ".exe" : ""}`,
  ];
  for (const path of paths) {
    try {
      const { success } = await new Deno.Command(path, {
        args: ["--version"],
        stdout: "piped",
        stderr: "piped",
      }).output();
      if (success) return path;
    } catch { /* not found */ }
  }
  return null;
}

async function downloadAndExtract(
  url: string,
  binaryName: string,
): Promise<string> {
  await Deno.mkdir(TWEED_BIN, { recursive: true });
  const destPath = `${TWEED_BIN}/${binaryName}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
  }
  const data = new Uint8Array(await resp.arrayBuffer());

  if (url.endsWith(".zip")) {
    const tmpZip = `${TWEED_BIN}/_tmp_${binaryName}.zip`;
    await Deno.writeFile(tmpZip, data);
    const { success } = await new Deno.Command("unzip", {
      args: ["-o", tmpZip, binaryName, "-d", TWEED_BIN],
      stdout: "piped",
      stderr: "piped",
    }).output();
    try {
      await Deno.remove(tmpZip);
    } catch { /* */ }
    if (!success) throw new Error(`Failed to unzip ${binaryName}`);
  } else {
    const proc = new Deno.Command("tar", {
      args: ["xzf", "-", "-C", TWEED_BIN, binaryName],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    const writer = proc.stdin.getWriter();
    await writer.write(data);
    await writer.close();
    const { success } = await proc.output();
    if (!success) throw new Error(`Failed to extract ${binaryName}`);
  }

  if (Deno.build.os !== "windows") {
    await Deno.chmod(destPath, 0o755);
  }
  return destPath;
}

export interface ResolvedDeps {
  scc: string;
  beret: string | null;
}

export async function ensureDeps(
  noBeret: boolean,
  log: (msg: string) => void,
): Promise<ResolvedDeps> {
  let sccPath = await commandExists("scc");
  if (!sccPath) {
    const asset = sccAssetName();
    const url =
      `https://github.com/boyter/scc/releases/download/${SCC_VERSION}/${asset}`;
    log(`scc not found — downloading ${SCC_VERSION}...`);
    try {
      sccPath = await downloadAndExtract(url, "scc");
      log(`scc installed to ${sccPath}`);
    } catch (e) {
      throw new Error(
        `Failed to download scc: ${e}. Install manually from https://github.com/boyter/scc`,
      );
    }
  }

  let beretPath: string | null = null;
  if (!noBeret) {
    beretPath = await commandExists("beret");
    if (!beretPath) {
      const asset = beretAssetName();
      const url =
        `https://github.com/chapeaux/beret/releases/download/${BERET_VERSION}/${asset}`;
      log(`beret not found — downloading ${BERET_VERSION}...`);
      try {
        beretPath = await downloadAndExtract(url, "beret");
        log(`beret installed to ${beretPath}`);
      } catch {
        log("beret download failed — structural analysis will be skipped");
        beretPath = null;
      }
    }
  }

  return { scc: sccPath, beret: beretPath };
}
