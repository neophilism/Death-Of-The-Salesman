CREATE TABLE app.agent_project_assignments (
  id app.entity_id PRIMARY KEY DEFAULT app.new_id(),
  organization_id app.entity_id NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  agent_identity_id app.entity_id NOT NULL,
  project_id app.entity_id NOT NULL,
  campaign_id app.entity_id,
  priority smallint NOT NULL CHECK (priority BETWEEN 0 AND 100),
  allocation_basis_points integer NOT NULL CHECK (allocation_basis_points BETWEEN 1 AND 10000),
  quota_limit bigint NOT NULL CHECK (quota_limit > 0),
  concurrency_cap integer NOT NULL CHECK (concurrency_cap BETWEEN 1 AND 1000),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by_membership_id app.entity_id NOT NULL,
  created_at timestamptz NOT NULL DEFAULT app.utc_now(),
  updated_at timestamptz NOT NULL DEFAULT app.utc_now(),
  UNIQUE (organization_id, id),
  UNIQUE NULLS NOT DISTINCT (
    organization_id, agent_identity_id, project_id, campaign_id
  ),
  FOREIGN KEY (organization_id, agent_identity_id)
    REFERENCES app.agent_identities(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, project_id)
    REFERENCES app.projects(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, updated_by_membership_id)
    REFERENCES app.memberships(organization_id, id)
);

ALTER TABLE app.agent_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.agent_project_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY agent_project_assignments_tenant_isolation ON app.agent_project_assignments
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());
