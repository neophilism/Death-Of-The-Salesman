export const AGENT_ROSTER_PAGE_SIZE = 24;

export type RosterStatus = "running" | "waiting" | "inactive";
export type RosterStatusFilter = "all" | RosterStatus;
export type RosterEvent = {
  readonly id: string;
  readonly occurredAt: string;
  readonly label: string;
  readonly result: string;
  readonly verified: boolean;
  readonly source: "persisted-run" | "synthetic-preview";
};

export type RosterAgent = {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly assignedModel: string;
  readonly status: RosterStatus;
  readonly statusLabel: string;
  readonly availability: string;
  readonly currentTask: string;
  readonly strategy: string;
  readonly lastActivityAt: string | null;
  readonly resultSummary: string;
  readonly spend: Readonly<{ currency: string; amountMinor: number }>;
  readonly events: readonly RosterEvent[];
};

export type RosterPage = { readonly items: readonly RosterAgent[]; readonly page: number; readonly pageCount: number; readonly total: number; };
const normalized = (value: string): string => value.trim().toLocaleLowerCase("en-US");

export const verifiedRosterEvents = (events: readonly RosterEvent[]): readonly RosterEvent[] => Object.freeze(
  events.filter((event) => event.verified === true && event.source === "persisted-run"),
);

export const filterRosterAgents = (agents: readonly RosterAgent[],query: string,status: RosterStatusFilter): readonly RosterAgent[] => {
  const search=normalized(query);
  return agents.filter((agent)=>status==="all"||agent.status===status).filter((agent)=>!search||[agent.name,agent.role,agent.assignedModel,agent.availability,agent.currentTask,agent.strategy,agent.resultSummary].some((value)=>normalized(value).includes(search)));
};

export const paginateRosterAgents = (agents: readonly RosterAgent[],requestedPage: number,pageSize=AGENT_ROSTER_PAGE_SIZE): RosterPage => {
  if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw new Error("pageSize must be an integer from 1 to 100");
  const pageCount=Math.max(1,Math.ceil(agents.length/pageSize)),finitePage=Number.isSafeInteger(requestedPage)?requestedPage:1,page=Math.min(pageCount,Math.max(1,finitePage)),start=(page-1)*pageSize;
  return Object.freeze({items:agents.slice(start,start+pageSize),page,pageCount,total:agents.length});
};
