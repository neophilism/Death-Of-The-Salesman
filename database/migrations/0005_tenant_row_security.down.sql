DROP POLICY tenant_isolation ON app.delegation_grants;
ALTER TABLE app.delegation_grants DISABLE ROW LEVEL SECURITY;
DROP POLICY tenant_isolation ON app.owner_sessions;
ALTER TABLE app.owner_sessions DISABLE ROW LEVEL SECURITY;
DROP POLICY tenant_isolation ON app.organization_auth_policies;
ALTER TABLE app.organization_auth_policies DISABLE ROW LEVEL SECURITY;
DROP POLICY tenant_isolation ON app.organization_settings;
ALTER TABLE app.organization_settings DISABLE ROW LEVEL SECURITY;
DROP POLICY tenant_isolation ON app.memberships;
ALTER TABLE app.memberships DISABLE ROW LEVEL SECURITY;
DROP POLICY tenant_isolation ON app.organizations;
ALTER TABLE app.organizations DISABLE ROW LEVEL SECURITY;

REVOKE SELECT, INSERT, UPDATE, DELETE ON
  app.organizations,
  app.memberships,
  app.organization_settings,
  app.organization_auth_policies,
  app.owner_sessions,
  app.delegation_grants
FROM dots_runtime;
REVOKE EXECUTE ON FUNCTION app.utc_now() FROM dots_runtime;
REVOKE EXECUTE ON FUNCTION app.new_id() FROM dots_runtime;
REVOKE EXECUTE ON FUNCTION app.current_organization_id() FROM dots_runtime;
REVOKE USAGE ON TYPE app.entity_id FROM dots_runtime;
REVOKE USAGE ON SCHEMA app FROM dots_runtime;
DROP FUNCTION app.current_organization_id();
DROP ROLE dots_runtime;
