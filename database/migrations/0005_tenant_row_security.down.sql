DROP POLICY auth_identities_membership_isolation ON app.auth_identities;
ALTER TABLE app.auth_identities DISABLE ROW LEVEL SECURITY;

DROP POLICY owner_users_membership_isolation ON app.owner_users;
ALTER TABLE app.owner_users DISABLE ROW LEVEL SECURITY;

DROP POLICY delegation_grants_tenant_isolation ON app.delegation_grants;
ALTER TABLE app.delegation_grants DISABLE ROW LEVEL SECURITY;

DROP POLICY owner_sessions_tenant_isolation ON app.owner_sessions;
ALTER TABLE app.owner_sessions DISABLE ROW LEVEL SECURITY;

DROP POLICY organization_auth_policies_tenant_isolation ON app.organization_auth_policies;
ALTER TABLE app.organization_auth_policies DISABLE ROW LEVEL SECURITY;

DROP POLICY organization_settings_tenant_isolation ON app.organization_settings;
ALTER TABLE app.organization_settings DISABLE ROW LEVEL SECURITY;

DROP POLICY memberships_tenant_isolation ON app.memberships;
ALTER TABLE app.memberships DISABLE ROW LEVEL SECURITY;

DROP POLICY organizations_tenant_isolation ON app.organizations;
ALTER TABLE app.organizations DISABLE ROW LEVEL SECURITY;

DROP FUNCTION app.current_organization_id();
