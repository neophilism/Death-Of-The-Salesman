CREATE FUNCTION app.current_organization_id()
RETURNS app.entity_id
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::app.entity_id
$$;

ALTER TABLE app.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organizations_tenant_isolation ON app.organizations
  USING (id = app.current_organization_id())
  WITH CHECK (id = app.current_organization_id());

ALTER TABLE app.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY memberships_tenant_isolation ON app.memberships
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

ALTER TABLE app.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organization_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_settings_tenant_isolation ON app.organization_settings
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

ALTER TABLE app.organization_auth_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organization_auth_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_auth_policies_tenant_isolation ON app.organization_auth_policies
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

ALTER TABLE app.owner_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.owner_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_sessions_tenant_isolation ON app.owner_sessions
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

ALTER TABLE app.delegation_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.delegation_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY delegation_grants_tenant_isolation ON app.delegation_grants
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

ALTER TABLE app.owner_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.owner_users FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_users_membership_isolation ON app.owner_users
  USING (
    EXISTS (
      SELECT 1
      FROM app.memberships
      WHERE memberships.user_id = owner_users.id
        AND memberships.organization_id = app.current_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app.memberships
      WHERE memberships.user_id = owner_users.id
        AND memberships.organization_id = app.current_organization_id()
    )
  );

ALTER TABLE app.auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.auth_identities FORCE ROW LEVEL SECURITY;
CREATE POLICY auth_identities_membership_isolation ON app.auth_identities
  USING (
    EXISTS (
      SELECT 1
      FROM app.memberships
      WHERE memberships.user_id = auth_identities.user_id
        AND memberships.organization_id = app.current_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app.memberships
      WHERE memberships.user_id = auth_identities.user_id
        AND memberships.organization_id = app.current_organization_id()
    )
  );
