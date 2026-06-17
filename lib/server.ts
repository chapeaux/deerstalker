const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function markdownToHtml(md: string): string {
  let html = md;

  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  const tableBlocks: string[] = [];
  html = html.replace(
    /(\|.+\|\n\|[-|: ]+\|\n(?:\|.+\|\n?)*)/g,
    (_match, table: string) => {
      const rows = table.trim().split("\n");
      if (rows.length < 2) return table;
      const headerCells = rows[0].split("|").filter((c: string) => c.trim());
      const alignRow = rows[1].split("|").filter((c: string) => c.trim());
      const aligns = alignRow.map((c: string) => {
        if (c.trim().endsWith(":") && c.trim().startsWith(":")) return "center";
        if (c.trim().endsWith(":")) return "right";
        return "left";
      });
      let t = "<table>\n<thead><tr>";
      headerCells.forEach((c: string, i: number) => {
        t += `<th style="text-align:${aligns[i] ?? "left"}">${c.trim()}</th>`;
      });
      t += "</tr></thead>\n<tbody>\n";
      for (let r = 2; r < rows.length; r++) {
        const cells = rows[r].split("|").filter((c: string) => c.trim());
        t += "<tr>";
        cells.forEach((c: string, i: number) => {
          t += `<td style="text-align:${aligns[i] ?? "left"}">${c.trim()}</td>`;
        });
        t += "</tr>\n";
      }
      t += "</tbody></table>";
      tableBlocks.push(t);
      return `\x00TABLE${tableBlocks.length - 1}\x00`;
    },
  );

  html = html.replace(/\n{2,}/g, "\n<p>\n");

  for (let i = 0; i < tableBlocks.length; i++) {
    html = html.replace(`\x00TABLE${i}\x00`, tableBlocks[i]);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comparison Report (Markdown)</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: "Red Hat Text", system-ui, sans-serif; background: #1b1d21; color: #e0e0e0; margin: 0; padding: 2rem; max-width: 1200px; margin: 0 auto; line-height: 1.6; }
  h1 { font-size: 2rem; border-bottom: 1px solid #444; padding-bottom: 0.5rem; }
  h2 { color: #73bcf7; border-bottom: 1px solid #333; padding-bottom: 0.3rem; margin-top: 2rem; }
  h3 { color: #c7c7c7; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.875rem; }
  th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 2px solid #444; color: #999; font-weight: 500; }
  td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #292929; }
  tr:hover { background: rgba(255,255,255,0.03); }
  code { background: #2a2a2a; padding: 0.1em 0.3em; border-radius: 3px; font-family: "Red Hat Mono", monospace; font-size: 0.875em; }
  strong { color: #f0f0f0; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

let sseController: ReadableStreamDefaultController | null = null;

export function notifyReload() {
  if (sseController) {
    try {
      sseController.enqueue(new TextEncoder().encode("data: reload\n\n"));
    } catch { /* client disconnected */ }
  }
}

export function startServer(
  outDir: string,
  port: number,
  liveReload: boolean,
): Deno.HttpServer {
  const server = Deno.serve({ port, onListen: () => {} }, async (req) => {
    const url = new URL(req.url);
    let path = url.pathname;

    if (liveReload && path === "/__sse") {
      const stream = new ReadableStream({
        start(controller) {
          sseController = controller;
        },
        cancel() {
          sseController = null;
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    if (path === "/") {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Tweed Reports</title>
<style>
  body { font-family: "Red Hat Text", system-ui, sans-serif; background: #1b1d21; color: #e0e0e0; margin: 0; padding: 2rem; max-width: 600px; margin: 0 auto; }
  h1 { font-size: 1.5rem; }
  a { color: #73bcf7; text-decoration: none; }
  a:hover { text-decoration: underline; }
  ul { list-style: none; padding: 0; }
  li { padding: 0.75rem 0; border-bottom: 1px solid #333; font-size: 1.1rem; }
</style>
</head>
<body>
<h1>Tweed Reports</h1>
<ul id="links"></ul>
<script>
  const prefixes = ['analysis', 'comparison'];
  const exts = [['html', 'HTML Dashboard'], ['md', 'Markdown Report'], ['json', 'JSON Data']];
  const ul = document.getElementById('links');
  for (const p of prefixes) {
    for (const [ext, label] of exts) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '/' + p + '.' + ext;
      a.textContent = label + ' (' + p + ')';
      li.appendChild(a);
      ul.appendChild(li);
      fetch(a.href, {method:'HEAD'}).then(r => { if (!r.ok) li.style.display = 'none'; }).catch(() => li.style.display = 'none');
    }
  }
</script>
</body>
</html>`;
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (path.startsWith("/")) path = path.slice(1);
    const filePath = `${outDir}/${path}`;

    try {
      const content = await Deno.readFile(filePath);
      const ext = filePath.substring(filePath.lastIndexOf("."));
      let contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

      if (ext === ".md") {
        const md = new TextDecoder().decode(content);
        const html = markdownToHtml(md);
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      let body: BodyInit = content;
      if (liveReload && ext === ".html") {
        const html = new TextDecoder().decode(content);
        if (!html.includes("/__sse")) {
          const script = `<script>
const es = new EventSource("/__sse");
es.onmessage = () => location.reload();
es.onerror = () => setTimeout(() => location.reload(), 2000);
</script>`;
          body = html.replace("</body>", `${script}</body>`);
        }
        contentType = "text/html; charset=utf-8";
      }

      return new Response(body, { headers: { "Content-Type": contentType } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });

  return server;
}
