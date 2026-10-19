CREATE ROLE dots_runtime
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

CREATE FUNCTION app.current_organization_id()
RETURNS app.entity_id
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::app.entity_id
$$;

REVOKE ALL ON FUNCTION app.current_organization_id() FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO dots_runtime;
GRANT USAGE ON TYPE app.entity_id TO dots_runtime;
GRANT EXECUTE ON FUNCTION app.current_organization_id() TO dots_runtime;
GRANT EXECUTE ON FUNCTION app.new_id() TO dots_runtime;
GRANT EXECUTE ON FUNCTION app.utc_now() TO dots_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  app.organizations,
  app.memberships,
  app.organization_settings,
  app.organization_auth_policies,
  app.owner_sessions,
  app.delegation_grants
TO dots_runtime;

ALTER TABLE app.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.organizations
  FOR ALL TO dots_runtime
  USING (id = app.current_organization_id())
  WITH CHECK (id = app.current_organization_id());

ALTER TABLE app.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.memberships
  FOR ALL TO dots_runtime
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

ALTER TABLE app.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organization_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.organization_settings
  FOR ALL TO dots_runtime
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

ALTER TABLE app.organization_auth_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organization_auth_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.organization_auth_policies
  FOR ALL TO dots_runtime
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

ALTER TABLE app.owner_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.owner_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.owner_sessions
  FOR ALL TO dots_runtime
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

ALTER TABLE app.delegation_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.delegation_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.delegation_grants
  FOR ALL TO dots_runtime
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());
