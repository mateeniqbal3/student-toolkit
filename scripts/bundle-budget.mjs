/**
 * Measures the real gzipped JavaScript a browser downloads for a route and
 * fails if it exceeds the budget.
 *
 * Next 16 no longer prints per-route sizes at build time, and the audience for
 * this app is on slow mobile connections, so the budget is checked rather than
 * assumed. Run after `npm run build`:
 *
 *   npm run budget
 */
import { spawn } from "node:child_process";
import { gzipSync } from "node:zlib";

const PORT = Number(process.env.BUDGET_PORT ?? 3123);
const ORIGIN = `http://127.0.0.1:${PORT}`;

/**
 * Gzipped KB of JavaScript allowed per route on first load.
 *
 * Next 16 App Router with React 19 has a floor of roughly 157KB before a single
 * line of application code: react-dom (72KB), the app-router client runtime
 * (47KB) and React core (39KB). The budget is therefore set from what the stack
 * can actually reach, with enough headroom to catch a regression but not so
 * much that a careless import slips through. Lowering it further means changing
 * frameworks, not changing code.
 */
const BUDGETS = {
  "/": 195,
  "/percentage-calculator": 215,
  "/gpa-calculator": 240,
  "/unit-converter": 240,
  "/citation-generator": 245,
  "/timetable-maker": 245,
  "/flashcards": 240,
  "/pomodoro-timer": 245,
};

const server = spawn("npx", ["next", "start", "--port", String(PORT)], {
  stdio: "ignore",
  detached: false,
});

const shutdown = () => {
  if (!server.killed) server.kill("SIGTERM");
};
process.on("exit", shutdown);
process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(ORIGIN, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Server did not start on ${ORIGIN}`);
}

async function measure(route) {
  const html = await (await fetch(`${ORIGIN}${route}`)).text();

  // Every script the document pulls in, whether via <script src> or a preload.
  const assets = [
    ...new Set([...html.matchAll(/\/_next\/static\/[^"'\s]+?\.js/g)].map((m) => m[0])),
  ];

  let total = 0;
  for (const asset of assets) {
    const body = Buffer.from(await (await fetch(`${ORIGIN}${asset}`)).arrayBuffer());
    total += gzipSync(body).length;
  }

  return { assets: assets.length, kb: total / 1024 };
}

await waitForServer();

let failed = false;
console.log("Route                    gzipped JS   budget   files");
console.log("-".repeat(56));

for (const [route, budgetKb] of Object.entries(BUDGETS)) {
  const { assets, kb } = await measure(route);
  const over = kb > budgetKb;
  if (over) failed = true;

  console.log(
    `${route.padEnd(24)} ${`${kb.toFixed(1)} KB`.padStart(10)}   ${`${budgetKb} KB`.padStart(6)}   ${String(assets).padStart(5)}  ${over ? "OVER BUDGET" : "ok"}`,
  );
}

shutdown();
process.exit(failed ? 1 : 0);
