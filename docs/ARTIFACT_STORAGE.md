# Encrypted artifact storage

The `@dots/storage` package is the DOTS-013 boundary for attachments, raw evidence, reports,
decks and generated assets. It encrypts every object with AES-256-GCM before a backend sees bytes.
PostgreSQL will own searchable metadata in a later unit; object bodies do not belong in Git or
database rows.

## Guarantees

- Object keys contain a validated organization ID, artifact ID and immutable positive version.
- Each write receives a new version and records its exact size, SHA-256 digest, media type,
  creation time, scan evidence and encryption-key identifier.
- Reads repeat the organization/artifact/version boundary check, authenticate metadata as
  AES-GCM additional data, and verify the plaintext size and digest.
- The configured maximum is 10 MiB by default and can only be changed to a positive safe integer.
- JSON, CSV and plain text may carry explicit `not-required` scan evidence. Every other media
  type requires a canonical clean scan result before storage.
- Backend adapters must declare immutable versions, tenant-scoped keys and versioned objects.
  The constructor rejects a backend missing any capability; deployment durability is a separate
  production acceptance gate.
- The included in-memory backend is for local development and tests only. It is neither durable
  nor a production cloud-store implementation.

## Adapter boundary

A future cloud adapter implements `ArtifactObjectBackend`. It receives only ciphertext plus
authenticated metadata, must perform atomic create-only writes, and must scope list/get operations
by organization. Provider credentials, buckets, KMS configuration, retention locks, lifecycle
rules and signed-download endpoints remain outside this package and require separately reviewed
configuration. No cloud resources or paid services are provisioned by DOTS-013.

Encryption keys are injected as 32 secret bytes and identified by a non-secret key ID. They must
come from an approved secret manager in deployed environments, never from repository files,
browser requests, logs or object metadata. Key rotation and re-encryption are later operational
work and are not claimed here.
