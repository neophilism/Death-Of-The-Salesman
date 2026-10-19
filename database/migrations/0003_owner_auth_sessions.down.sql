DROP TABLE app.owner_sessions;
DROP TABLE app.organization_auth_policies;
DROP TABLE app.auth_identities;
ALTER TABLE app.memberships
  DROP CONSTRAINT memberships_organization_id_id_user_id_key;
