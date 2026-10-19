CREATE SCHEMA app;

CREATE DOMAIN app.entity_id AS uuid
  CHECK (VALUE <> '00000000-0000-0000-0000-000000000000'::uuid);

CREATE FUNCTION app.new_id()
RETURNS app.entity_id
LANGUAGE sql
VOLATILE
AS $$ SELECT gen_random_uuid()::app.entity_id $$;

CREATE FUNCTION app.utc_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$ SELECT CURRENT_TIMESTAMP $$;

