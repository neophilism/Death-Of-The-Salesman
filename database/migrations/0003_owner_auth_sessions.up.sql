ALTER TABLE app.memberships
  ADD CONSTRAINT memberships_organization_id_id_user_id_key
  UNIQUE (organization_id, id, user_id);

CREATE TABLE app.auth_identities (
  id app.entity_id PRIMARY KEY DEFAULT app.new_id(),
  user_id app.entity_id NOT NULL REFERENCES app.owner_users(id) ON DELETE CASCADE,
  issuer text NOT NULL CHECK (issuer = btrim(issuer) AND issuer <> ''),
  subject text NOT NULL CHECK (subject = btrim(subject) AND subject <> ''),
  created_at timestamptz NOT NULL DEFAULT app.utc_now(),
  UNIQUE (issuer, subject)
);

CREATE TABLE app.organization_auth_policies (
  organization_id app.entity_id PRIMARY KEY REFERENCES app.organizations(id) ON DELETE CASCADE,
  admin_mfa_required boolean NOT NULL DEFAULT true,
  mfa_max_age_seconds integer NOT NULL DEFAULT 900 CHECK (mfa_max_age_seconds BETWEEN 60 AND 86400),
  updated_at timestamptz NOT NULL DEFAULT app.utc_now()
);

CREATE TABLE app.owner_sessions (
  id app.entity_id PRIMARY KEY DEFAULT app.new_id(),
  organization_id app.entity_id NOT NULL,
  user_id app.entity_id NOT NULL,
  membership_id app.entity_id NOT NULL,
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  csrf_hash bytea NOT NULL CHECK (octet_length(csrf_hash) = 32),
  created_at timestamptz NOT NULL DEFAULT app.utc_now(),
  last_seen_at timestamptz NOT NULL DEFAULT app.utc_now(),
  expires_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  idle_timeout_seconds integer NOT NULL CHECK (idle_timeout_seconds BETWEEN 60 AND 86400),
  mfa_verified_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (idle_expires_at > created_at AND idle_expires_at <= expires_at),
  CHECK (mfa_verified_at IS NULL OR mfa_verified_at <= created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  FOREIGN KEY (organization_id, membership_id, user_id)
    REFERENCES app.memberships(organization_id, id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES app.owner_users(id) ON DELETE CASCADE
);

CREATE INDEX owner_sessions_active_lookup
  ON app.owner_sessions(token_hash)
  WHERE revoked_at IS NULL;
