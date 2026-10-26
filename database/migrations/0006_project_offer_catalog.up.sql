CREATE TABLE app.projects (
  id app.entity_id PRIMARY KEY DEFAULT app.new_id(),
  organization_id app.entity_id NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  project_id app.entity_id,
  offer_id app.entity_id,
  label text NOT NULL CHECK (label = btrim(label) AND length(label) BETWEEN 1 AND 240),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by_membership_id app.entity_id NOT NULL,
  created_at timestamptz NOT NULL DEFAULT app.utc_now(),
  updated_at timestamptz NOT NULL DEFAULT app.utc_now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, updated_by_membership_id)
    REFERENCES app.memberships(organization_id, id),
  CHECK (project_id IS NULL AND offer_id IS NULL)
);

CREATE TABLE app.offers (
  id app.entity_id PRIMARY KEY DEFAULT app.new_id(),
  organization_id app.entity_id NOT NULL,
  project_id app.entity_id NOT NULL,
  offer_id app.entity_id,
  label text NOT NULL CHECK (label = btrim(label) AND length(label) BETWEEN 1 AND 240),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by_membership_id app.entity_id NOT NULL,
  created_at timestamptz NOT NULL DEFAULT app.utc_now(),
  updated_at timestamptz NOT NULL DEFAULT app.utc_now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES app.projects(organization_id, id),
  FOREIGN KEY (organization_id, updated_by_membership_id)
    REFERENCES app.memberships(organization_id, id),
  CHECK (offer_id IS NULL)
);

CREATE TABLE app.pricing_summaries (
  id app.entity_id PRIMARY KEY DEFAULT app.new_id(),
  organization_id app.entity_id NOT NULL,
  project_id app.entity_id NOT NULL,
  offer_id app.entity_id NOT NULL,
  label text NOT NULL CHECK (label = btrim(label) AND length(label) BETWEEN 1 AND 240),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by_membership_id app.entity_id NOT NULL,
  created_at timestamptz NOT NULL DEFAULT app.utc_now(),
  updated_at timestamptz NOT NULL DEFAULT app.utc_now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES app.projects(organization_id, id),
  FOREIGN KEY (organization_id, project_id, offer_id)
    REFERENCES app.offers(organization_id, project_id, id),
  FOREIGN KEY (organization_id, updated_by_membership_id)
    REFERENCES app.memberships(organization_id, id)
);

CREATE TABLE app.vetted_product_facts (
  id app.entity_id PRIMARY KEY DEFAULT app.new_id(),
  organization_id app.entity_id NOT NULL,
  project_id app.entity_id NOT NULL,
  offer_id app.entity_id NOT NULL,
  label text NOT NULL CHECK (label = btrim(label) AND length(label) BETWEEN 1 AND 240),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by_membership_id app.entity_id NOT NULL,
  created_at timestamptz NOT NULL DEFAULT app.utc_now(),
  updated_at timestamptz NOT NULL DEFAULT app.utc_now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES app.projects(organization_id, id),
  FOREIGN KEY (organization_id, project_id, offer_id)
    REFERENCES app.offers(organization_id, project_id, id),
  FOREIGN KEY (organization_id, updated_by_membership_id)
    REFERENCES app.memberships(organization_id, id)
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['projects', 'offers', 'pricing_summaries', 'vetted_product_facts']
  LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON app.%I USING (organization_id = app.current_organization_id()) WITH CHECK (organization_id = app.current_organization_id())',
      table_name || '_tenant_isolation', table_name
    );
  END LOOP;
END
$$;
