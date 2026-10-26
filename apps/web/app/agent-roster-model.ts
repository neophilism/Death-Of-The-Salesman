export const AGENT_ROSTER_PAGE_SIZE = 24;

export type RosterStatus = "running" | "waiting" | "inactive";
export type RosterStatusFilter = "all" | RosterStatus;

export type RosterAgent = {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly assignedModel: string;
  readonly status: RosterStatus;
  readonly statusLabel: string;
  readonly availability: string;
};

export type RosterPage = {
  readonly items: readonly RosterAgent[];
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
};

const normalized = (value: string): string => value.trim().toLocaleLowerCase("en-US");

export const filterRosterAgents = (
  agents: readonly RosterAgent[],
  query: string,
  status: RosterStatusFilter,
): readonly RosterAgent[] => {
  const search = normalized(query);
  return agents.filter((agent) => {
    if (status !== "all" && agent.status !== status) return false;
    if (!search) return true;
    return [agent.name, agent.role, agent.assignedModel, agent.availability, agent.statusLabel]
      .some((value) => normalized(value).includes(search));
  });
};

export const paginateRosterAgents = (
  agents: readonly RosterAgent[],
  requestedPage: number,
  pageSize = AGENT_ROSTER_PAGE_SIZE,
): RosterPage => {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error("pageSize must be an integer from 1 to 100");
  }
  const pageCount = Math.max(1, Math.ceil(agents.length / pageSize));
  const finitePage = Number.isSafeInteger(requestedPage) ? requestedPage : 1;
  const page = Math.min(pageCount, Math.max(1, finitePage));
  const start = (page - 1) * pageSize;
  return Object.freeze({
    items: agents.slice(start, start + pageSize),
    page,
    pageCount,
    total: agents.length,
  });
};
