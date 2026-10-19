CREATE TABLE app.organizations (
  id app.entity_id PRIMARY KEY DEFAULT app.new_id(),
  ownership_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  display_name text NOT NULL CHECK (display_name = btrim(display_name) AND display_name <> ''),
  created_at timestamptz NOT NULL DEFAULT app.utc_now(),
  updated_at timestamptz NOT NULL DEFAULT app.utc_now()
);

CREATE TABLE app.owner_users (
  id app.entity_id PRIMARY KEY DEFAULT app.new_id(),
  identity_subject text NOT NULL UNIQUE
    CHECK (identity_subject = btrim(identity_subject) AND identity_subject <> ''),
  display_name text NOT NULL CHECK (display_name = btrim(display_name) AND display_name <> ''),
  created_at timestamptz NOT NULL DEFAULT app.utc_now(),
  updated_at timestamptz NOT NULL DEFAULT app.utc_now()
);

CREATE TABLE app.memberships (
  id app.entity_id PRIMARY KEY DEFAULT app.new_id(),
  organization_id app.entity_id NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  user_id app.entity_id NOT NULL REFERENCES app.owner_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'sales_manager')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT app.utc_now(),
  updated_at timestamptz NOT NULL DEFAULT app.utc_now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE app.organization_settings (
  organization_id app.entity_id PRIMARY KEY REFERENCES app.organizations(id) ON DELETE CASCADE,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
  updated_by_membership_id app.entity_id NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT app.utc_now(),
  FOREIGN KEY (organization_id, updated_by_membership_id)
    REFERENCES app.memberships(organization_id, id)
);

