import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AGENT_ROSTER_PAGE_SIZE,
  filterRosterAgents,
  paginateRosterAgents,
} from "../apps/web/app/agent-roster-model.ts";

const agent = (index, status = "inactive") => ({
  id: `agent-${index}`,
  name: `Synthetic Agent ${index}`,
  role: index % 2 === 0 ? "Sales strategist" : "Fundraising researcher",
  assignedModel: index % 3 === 0 ? "Candidate A" : "Not assigned",
  status,
  statusLabel: status === "running" ? "Running" : status === "waiting" ? "Waiting" : "Inactive",
  availability: status === "running" ? "Fresh heartbeat" : "No active worker",
});

test("two-record roster remains one bounded page", () => {
  const page = paginateRosterAgents([agent(1), agent(2)], 1);
  assert.equal(AGENT_ROSTER_PAGE_SIZE, 24);
  assert.equal(page.total, 2);
  assert.equal(page.pageCount, 1);
  assert.equal(page.items.length, 2);
});

test("two thousand synthetic identities paginate without rendering the full collection", () => {
  const agents = Array.from({ length: 2_000 }, (_, index) => agent(index + 1));
  const first = paginateRosterAgents(agents, 1);
  const last = paginateRosterAgents(agents, 999);
  assert.equal(first.pageCount, 84);
  assert.equal(first.items.length, 24);
  assert.equal(last.page, 84);
  assert.equal(last.items.length, 8);
  assert.equal(new Set([...first.items, ...last.items].map((item) => item.id)).size, 32);
});

test("search and status filters use visible roster facts", () => {
  const agents = [
    { ...agent(1, "running"), name: "Fast Eddie Felson", assignedModel: "Candidate A" },
    { ...agent(2, "waiting"), name: "Harry Wormwood", availability: "Awaiting owner review" },
  ];
  assert.deepEqual(filterRosterAgents(agents, "EDDIE", "all").map((item) => item.id), ["agent-1"]);
  assert.deepEqual(filterRosterAgents(agents, "owner review", "waiting").map((item) => item.id), ["agent-2"]);
  assert.deepEqual(filterRosterAgents(agents, "", "inactive"), []);
  assert.throws(() => paginateRosterAgents(agents, 1, 0), /pageSize/);
});

test("roster exposes labeled filters, live results, paging and keyboard controls", async () => {
  const source = await readFile(new URL("../apps/web/app/agent-roster.tsx", import.meta.url), "utf8");
  for (const contract of [
    'type="search"',
    "<select",
    'aria-live="polite"',
    'role="list"',
    'role="listitem"',
    'aria-label="Agent roster pages"',
    'event.key === "ArrowRight"',
    'event.key === "Home"',
    'event.key === "End"',
  ]) assert.ok(source.includes(contract), `missing roster contract: ${contract}`);
});
