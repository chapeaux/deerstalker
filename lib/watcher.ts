export interface WatcherOptions {
  dirs: string[];
  excludeDirs: string[];
  debounceMs?: number;
  onChange: () => Promise<void>;
}

export async function startWatcher(opts: WatcherOptions): Promise<void> {
  const debounce = opts.debounceMs ?? 500;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const watcher = Deno.watchFs(opts.dirs, { recursive: true });

  for await (const event of watcher) {
    const dominated = event.paths.every((p) =>
      opts.excludeDirs.some((ex) => {
        const segments = p.split("/");
        return segments.includes(ex);
      })
    );
    if (dominated) continue;
    if (event.kind === "access") continue;

    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if (running) return;
      running = true;
      const changed = event.paths.map((p) =>
        p.length > 60 ? "..." + p.slice(-57) : p
      ).join(", ");
      console.error(`\x1b[36m  Change detected:\x1b[0m ${changed}`);
      try {
        await opts.onChange();
      } catch (e) {
        console.error(`\x1b[31m  Reassessment failed:\x1b[0m ${e}`);
      }
      running = false;
    }, debounce);
  }
}
