CREATE TABLE app.delegation_grants (
  id app.entity_id PRIMARY KEY DEFAULT app.new_id(),
  organization_id app.entity_id NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  principal_kind text NOT NULL CHECK (principal_kind = 'agent'),
  principal_subject text NOT NULL
    CHECK (principal_subject = btrim(principal_subject) AND length(principal_subject) BETWEEN 1 AND 200),
  scopes text[] NOT NULL CHECK (
    cardinality(scopes) > 0
    AND scopes <@ ARRAY['projects:read', 'contacts:read', 'work:execute', 'proposals:create']::text[]
  ),
  resource_filter jsonb NOT NULL CHECK (jsonb_typeof(resource_filter) = 'object'),
  created_by_membership_id app.entity_id NOT NULL,
  created_at timestamptz NOT NULL DEFAULT app.utc_now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, created_by_membership_id)
    REFERENCES app.memberships(organization_id, id)
);

CREATE UNIQUE INDEX delegation_grants_one_active_subject
  ON app.delegation_grants(organization_id, principal_subject)
  WHERE revoked_at IS NULL;
