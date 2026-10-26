# Rights-safe agent avatars

DOTS-021 adds a server-side avatar boundary to `@dots/storage`. It accepts direct uploads only;
it never downloads an image URL. A missing, unreadable or invalid stored image resolves to an
accessible monogram so the roster remains usable without external media.

## Accepted uploads

- PNG and JPEG are the only accepted media types. The pipeline reads dimensions from the bytes,
  rejects malformed/truncated containers, and defaults to 64-2048 pixels on each edge and 5 MiB.
- The existing encrypted artifact store still requires canonical clean malware-scan evidence for
  image writes. Each agent's bytes use an immutable, tenant-scoped `agent-avatar-<identity UUID>`
  artifact key.
- Every write requires either an explicit creator affirmation for an original portrait or a user
  affirmation plus a bounded reference to a license record. The returned receipt carries that
  evidence with the exact artifact version and measured dimensions for the caller to persist.
- A name in the approved salesman roster does not grant rights to an actor's likeness, a film
  still, promotional art or any other third-party image. The repository contains no default image
  downloads, actor photographs or film stills.

Rights evidence is an admission control and audit boundary, not automated copyright verification.
Product/API layers must retain the receipt alongside the identity's selected avatar version and
must not infer a license from a filename, URL or approved display name.

## Rendering fallback

`resolve` returns stored bytes only after the encrypted store's tenant/integrity checks and a fresh
container/dimension check. An unset version, missing object, storage failure, invalid version or
unreadable image returns a deterministic one- or two-character monogram with useful alternative
text. Callers should render that descriptor directly and must not attempt a network fallback.
