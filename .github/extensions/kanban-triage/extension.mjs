import { createServer } from "node:http";
import { createCanvas, joinSession } from "@github/copilot-sdk/extension";

const repository = "AnkitSurana/tailspin-toys";
const servers = new Map();

const priorityReasons = {
    6: "This is the broadest performance and usability improvement, with data-layer, page, accessibility, unit-test, and end-to-end work all connected.",
    1: "Search is a foundational discovery feature and has a clear, user-visible payoff without requiring a schema change.",
    2: "Sorting complements discovery and gives users control over the catalog, while touching the existing list data and UI patterns.",
};

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function issueCard(issue, isPriority) {
    const reason = priorityReasons[issue.number] ?? "This issue is part of the remaining open work and is ready for triage.";
    return `
      <article class="card ${isPriority ? "priority-card" : ""}">
        <div class="card-header">
          <span class="issue-number">#${escapeHtml(issue.number)}</span>
          <span class="status">Open</span>
        </div>
        <h3>${escapeHtml(issue.title)}</h3>
        <p class="description">${escapeHtml(issue.body || "No description provided.")}</p>
        ${isPriority ? `<p class="reason"><strong>Why now:</strong> ${escapeHtml(reason)}</p>` : ""}
        <div class="card-footer">
          <a href="${escapeHtml(issue.html_url)}" target="_blank" rel="noreferrer">View issue</a>
          <button class="context-button" data-issue-number="${escapeHtml(issue.number)}">Add to current context</button>
        </div>
      </article>`;
}

function renderHtml(instanceId) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Issue triage board</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: var(--background-color-default, #ffffff);
        --text: var(--text-color-default, #1f2328);
        --muted: var(--text-color-muted, #656d76);
        --border: var(--border-color-default, #d0d7de);
        --accent: var(--true-color-blue, #0969da);
        --accent-muted: var(--true-color-blue-muted, #ddf4ff);
        --surface: color-mix(in srgb, var(--bg) 92%, var(--text));
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        background: var(--bg);
        color: var(--text);
        font: 14px/1.5 var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      }
      main { max-width: 980px; margin: 0 auto; }
      h1 { margin: 0 0 4px; font-size: 26px; }
      h2 { margin: 28px 0 12px; font-size: 18px; }
      .lede, .empty { color: var(--muted); }
      .board { display: grid; gap: 12px; }
      .card {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 16px;
        background: var(--surface);
      }
      .priority-card { border-color: var(--accent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent); }
      .card-header, .card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .issue-number { color: var(--accent); font-weight: 600; }
      .status { color: var(--muted); font-size: 12px; }
      h3 { margin: 8px 0; font-size: 16px; }
      .description, .reason { margin: 8px 0; white-space: pre-wrap; }
      .description { color: var(--muted); max-height: 7.5em; overflow: hidden; }
      .reason { padding: 10px; border-radius: 6px; background: var(--accent-muted); }
      a { color: var(--accent); }
      button {
        border: 1px solid var(--accent);
        border-radius: 6px;
        padding: 6px 10px;
        background: var(--accent);
        color: white;
        cursor: pointer;
        font: inherit;
      }
      button:hover { filter: brightness(1.08); }
      button:focus-visible, a:focus-visible { outline: 2px solid var(--color-focus-outline, #0969da); outline-offset: 2px; }
      button[disabled] { cursor: wait; opacity: .7; }
      #notice { min-height: 24px; margin-top: 16px; color: var(--muted); }
    </style>
  </head>
  <body>
    <main>
      <h1>Issue triage board</h1>
      <p class="lede">Open work for ${escapeHtml(repository)}. The first column is prioritized for immediate attention.</p>
      <div id="notice" role="status" aria-live="polite"></div>
      <section aria-labelledby="priority-heading">
        <h2 id="priority-heading">Most likely to need attention now</h2>
        <div id="priority" class="board"><p class="empty">Loading issues…</p></div>
      </section>
      <section aria-labelledby="remaining-heading">
        <h2 id="remaining-heading">Remaining open issues</h2>
        <div id="remaining" class="board"><p class="empty">Loading issues…</p></div>
      </section>
    </main>
    <script>
      const instanceId = ${JSON.stringify(instanceId)};
      const notice = document.getElementById("notice");

      function render(container, issues, priority) {
        container.innerHTML = issues.length
          ? issues.map((issue) => issue.card).join("")
          : '<p class="empty">No open issues in this section.</p>';
        container.querySelectorAll(".context-button").forEach((button) => {
          button.addEventListener("click", async () => {
            button.disabled = true;
            notice.textContent = "Adding issue to the current context…";
            try {
              const response = await fetch("/api/add", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ number: Number(button.dataset.issueNumber) }),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error || "Unable to add issue");
              notice.textContent = result.message;
            } catch (error) {
              notice.textContent = error.message;
              button.disabled = false;
            }
          });
        });
      }

      async function load() {
        try {
          const response = await fetch("/api/issues");
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Unable to load issues");
          render(document.getElementById("priority"), data.priority, true);
          render(document.getElementById("remaining"), data.remaining, false);
        } catch (error) {
          document.getElementById("priority").innerHTML = "";
          document.getElementById("remaining").innerHTML = '<p class="empty">Unable to load issues. ' + error.message + '</p>';
        }
      }
      load();
    </script>
  </body>
</html>`;
}

async function getIssues() {
    const response = await fetch(`https://api.github.com/repos/${repository}/issues?state=open&per_page=100`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "kanban-triage-extension" },
    });
    if (!response.ok) {
        throw new Error(`GitHub returned HTTP ${response.status}`);
    }
    const issues = await response.json();
    const openIssues = issues.filter((issue) => !issue.pull_request);
    const priorityNumbers = [6, 1, 2];
    const priority = priorityNumbers
        .map((number) => openIssues.find((issue) => issue.number === number))
        .filter(Boolean)
        .map((issue) => ({ ...issue, card: issueCard(issue, true) }));
    const prioritySet = new Set(priority.map((issue) => issue.number));
    const remaining = openIssues
        .filter((issue) => !prioritySet.has(issue.number))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((issue) => ({ ...issue, card: issueCard(issue, false) }));
    return { priority, remaining };
}

async function startServer(instanceId) {
    const server = createServer(async (req, res) => {
        try {
            if (req.url === "/" && req.method === "GET") {
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(renderHtml(instanceId));
                return;
            }
            if (req.url === "/api/issues" && req.method === "GET") {
                const data = await getIssues();
                res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify(data));
                return;
            }
            if (req.url === "/api/add" && req.method === "POST") {
                let body = "";
                for await (const chunk of req) body += chunk;
                const { number } = JSON.parse(body);
                const data = await getIssues();
                const issue = [...data.priority, ...data.remaining].find((item) => item.number === number);
                if (!issue) throw new Error("That issue is no longer open.");
                await session.send({
                    prompt: `Please add GitHub issue #${issue.number} to the current work context and start working on it: ${issue.title}\n\n${issue.body || "No issue description provided."}\n\nIssue URL: ${issue.html_url}`,
                });
                res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ message: `Issue #${number} added to the current context.` }));
                return;
            }
            res.writeHead(404);
            res.end("Not found");
        } catch (error) {
            res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }));
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/` };
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "kanban-triage",
            displayName: "Issue triage board",
            description: "A Kanban board that prioritizes open repository issues and adds selected issues to the current context.",
            actions: [
                {
                    name: "refresh_issues",
                    description: "Fetch the current prioritized and remaining open issues.",
                    handler: async () => getIssues(),
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(ctx.instanceId);
                    servers.set(ctx.instanceId, entry);
                }
                return { title: "Issue triage board", url: entry.url };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
