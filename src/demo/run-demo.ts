// Fires a batch of real user queries at the SYNTH router.
// Each query decomposes into 2–4 subtasks; every subtask triggers one real
// x402 USDC payment on the configured network. With the query list below we
// expect 60+ on-chain transactions per run, logged to stdout and written to
// demo-results/<timestamp>.json.

import fs from "node:fs";
import path from "node:path";
import { TaskResult } from "../shared/types.js";
import { config } from "../shared/config.js";

const ROUTER = config.routerUrl || "http://localhost:3000";

const QUERIES: string[] = [
  "Summarise the most recent developments in zero-knowledge rollups and pick the project with the best throughput story.",
  "Analyse this contract excerpt: 'The Party agrees to indemnify and hold harmless the Service Provider from all claims arising...' — flag any unusual clauses.",
  "Review this Go snippet for bugs: `func div(a, b int) int { return a / b }` — what breaks at runtime?",
  "What is Circle Nanopayments, who are the main competitors, and how does x402 fit into the stack?",
  "Compare gas costs for a $0.001 USDC transfer on Ethereum mainnet vs Base vs Arc; which chain wins for sub-cent economics?",
  "Research the current state of AI agent marketplaces and list the top three protocols with pay-per-call billing.",
  "Audit this Python function for security issues: `def run(cmd): os.system(cmd)` — what attacks apply?",
  "Read this resume blurb and pull out the top three skills: 'Built distributed systems at scale, ran on-call rotations, mentored 4 junior engineers on Rust.'",
  "Find the latest benchmarks for Claude 3.5 Sonnet vs GPT-4o on coding tasks, then summarise which one ships faster.",
  "Explain the EIP-3009 transferWithAuthorization flow and why it's what makes x402 possible without on-chain escrow.",
  "Take this JSON schema and spot any fields likely to cause backwards-compat pain: `{\"id\": \"string\", \"createdAt\": \"number\"}`.",
  "Give me a briefing on Arc (Circle's L1) — consensus, finality, gas model, and developer tooling maturity.",
  "Review this TypeScript for race conditions: `let n=0; async function bump(){ const v=n; await sleep(10); n=v+1; }`.",
  "Compare the HTTP 402 revival via x402 against Lightning's LSAT / L402 — what's different, what's the same?",
  "Summarise any news from the last week about stablecoin regulation in the US and EU, then rank the three most consequential items.",
  "Analyse this one-paragraph NDA and tell me if the non-solicit clause is enforceable: 'Party B shall not solicit any employee of Party A for two (2) years...'",
  "Review this SQL for injection risk: `SELECT * FROM users WHERE email = '\" + email + \"'` — fix it.",
  "What is the current TPS and median fee for Base, and how does that compare to Solana mainnet this week?",
];

interface DemoEntry {
  query: string;
  status: "ok" | "error";
  taskId?: string;
  subtasks?: number;
  invocations?: number;
  payments?: number;
  totalCostUsd?: number;
  userChargedUsd?: number;
  latencyMs?: number;
  txHashes?: string[];
  error?: string;
}

async function runOne(query: string): Promise<DemoEntry> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${ROUTER}/tasks/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { query, status: "error", error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }
    const data = (await res.json()) as TaskResult;
    const txHashes = data.payments.map((p) => p.txHash).filter(Boolean);
    return {
      query,
      status: "ok",
      taskId: data.taskId,
      subtasks: data.decomposition.subtasks.length,
      invocations: data.invocations.length,
      payments: data.payments.length,
      totalCostUsd: data.totalCostUsd,
      userChargedUsd: data.userChargedUsd,
      latencyMs: data.totalLatencyMs ?? Date.now() - t0,
      txHashes,
    };
  } catch (err) {
    return { query, status: "error", error: (err as Error).message };
  }
}

async function main() {
  console.log(`[demo] router: ${ROUTER}`);
  console.log(`[demo] firing ${QUERIES.length} queries...\n`);

  // Health check before we start.
  try {
    const h = await fetch(`${ROUTER}/health`);
    const hj = await h.json();
    console.log(`[demo] router health: ${JSON.stringify(hj)}\n`);
  } catch (err) {
    console.error(`[demo] router not reachable at ${ROUTER}. Start it with \`npm run start:all\`.`);
    process.exit(1);
  }

  const entries: DemoEntry[] = [];
  const allTxHashes: string[] = [];

  for (let i = 0; i < QUERIES.length; i++) {
    const q = QUERIES[i];
    process.stdout.write(`[demo] (${i + 1}/${QUERIES.length}) ${q.slice(0, 70)}${q.length > 70 ? "…" : ""}\n`);
    const entry = await runOne(q);
    entries.push(entry);
    if (entry.status === "ok") {
      console.log(
        `        -> ${entry.invocations} invocations, ${entry.payments} payments, ` +
          `$${entry.totalCostUsd?.toFixed(4)} spent, ${entry.latencyMs}ms`,
      );
      for (const tx of entry.txHashes ?? []) {
        console.log(`        tx: ${tx}`);
        allTxHashes.push(tx);
      }
    } else {
      console.log(`        -> ERROR: ${entry.error}`);
    }
  }

  const totals = entries.reduce(
    (acc, e) => {
      if (e.status === "ok") {
        acc.tasks += 1;
        acc.invocations += e.invocations ?? 0;
        acc.payments += e.payments ?? 0;
        acc.usd += e.totalCostUsd ?? 0;
      } else {
        acc.errors += 1;
      }
      return acc;
    },
    { tasks: 0, invocations: 0, payments: 0, usd: 0, errors: 0 },
  );

  console.log(`\n[demo] ============================================`);
  console.log(`[demo] tasks       : ${totals.tasks} (errors: ${totals.errors})`);
  console.log(`[demo] invocations : ${totals.invocations}`);
  console.log(`[demo] onchain tx  : ${totals.payments}`);
  console.log(`[demo] usdc settled: $${totals.usd.toFixed(6)}`);
  console.log(`[demo] target 50+  : ${totals.payments >= 50 ? "YES ✓" : "NOT YET"}`);
  console.log(`[demo] ============================================\n`);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve("demo-results");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${ts}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        network: config.x402Network,
        router: ROUTER,
        totals,
        allTxHashes,
        entries,
      },
      null,
      2,
    ),
  );
  console.log(`[demo] wrote results to ${outFile}`);
}

main().catch((e) => {
  console.error("[demo] fatal:", e);
  process.exit(1);
});
