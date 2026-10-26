CREATE TABLE app.project_buckets (
  id app.entity_id PRIMARY KEY DEFAULT app.new_id(),
  organization_id app.entity_id NOT NULL,
  project_id app.entity_id NOT NULL,
  campaign_id app.entity_id,
  label text NOT NULL CHECK (label = btrim(label) AND length(label) BETWEEN 1 AND 120),
  default_position integer NOT NULL CHECK (default_position >= 0),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by_membership_id app.entity_id NOT NULL,
  created_at timestamptz NOT NULL DEFAULT app.utc_now(),
  updated_at timestamptz NOT NULL DEFAULT app.utc_now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES app.projects(organization_id, id),
  FOREIGN KEY (organization_id, updated_by_membership_id)
    REFERENCES app.memberships(organization_id, id)
);

COMMENT ON COLUMN app.project_buckets.campaign_id IS
  'Optional stable campaign identifier. A campaign foreign key is added by the campaign-domain migration.';

CREATE TABLE app.project_bucket_preferences (
  organization_id app.entity_id NOT NULL,
  owner_membership_id app.entity_id NOT NULL,
  bucket_id app.entity_id NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  display_position integer NOT NULL CHECK (display_position >= 0),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT app.utc_now(),
  PRIMARY KEY (organization_id, owner_membership_id, bucket_id),
  FOREIGN KEY (organization_id, owner_membership_id)
    REFERENCES app.memberships(organization_id, id),
  FOREIGN KEY (organization_id, bucket_id)
    REFERENCES app.project_buckets(organization_id, id)
);

ALTER TABLE app.project_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.project_buckets FORCE ROW LEVEL SECURITY;
CREATE POLICY project_buckets_tenant_isolation ON app.project_buckets
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

ALTER TABLE app.project_bucket_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.project_bucket_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY project_bucket_preferences_tenant_isolation ON app.project_bucket_preferences
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());
