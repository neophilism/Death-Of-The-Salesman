
# Rights-safe agent avatars

DOTS-021 adds a deliberately local avatar boundary. The repository ships no portraits, actor likenesses, film stills, or remote image URLs. Every identity can be rendered immediately as a deterministic, text-labelled monogram.

## Accepted portrait path

`AvatarPipeline.storePortrait` accepts PNG bytes only after all of these checks pass:

- the image has a valid PNG signature and IHDR dimensions between 32 and 2048 pixels;
- the upload has clean malware-scan evidence;
- an active caller supplies either an original-work creator attestation or a user-license record reference;
- the agent and tenant use bounded storage identifiers.

The encrypted artifact store writes the image and a separate immutable JSON rights manifest. The manifest binds the tenant, agent, image version, digest, dimensions, media type, attester and rights basis. The pipeline has no URL downloader, default image fetch, actor-name lookup or bundled portrait directory.

The caller remains responsible for authorizing the attesting membership before invoking the storage package. License records must be retained for as long as the portrait is used.

## Presentation and fallback

Three stable presentation sizes are available: compact (40 px), standard (64 px), and profile (96 px). These are layout sizes; original bytes remain immutable and are not silently recompressed.

`presentAvatar` returns the stored image reference only when the image is accessible. Missing, failed or intentionally disabled images return the same named monogram fallback, so identity and accessible text do not depend on image delivery.

Commercial tenants receive no image or identity seed from this pipeline. Private-demo identities also remain monograms until an original or licensed portrait is explicitly uploaded.
