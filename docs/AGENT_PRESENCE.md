
# Authoritative agent presence

DOTS-022 defines one server-side reducer for the roster's green, yellow and red presence. Presentation code must consume this result; assignment, an enabled identity, synthetic preview data, or a client timer cannot independently claim that an agent is working.

## States

- Green / running requires a persisted `running` state, an unexpired lease and a worker heartbeat no older than the configured freshness window. The default freshness window is 30 seconds and is bounded to five minutes.
- Yellow / waiting represents persisted queue, schedule, review, reply, rate-limit, pause, block or budget-wait states. The persisted reason is shown verbatim.
- Red / inactive covers inactive or archived identities, missing or untrusted run evidence, expired leases, missing or stale heartbeats, recovery/error states and terminal runs.

Every derived value includes the exact last-activity timestamp, reason, underlying run state, lease expiration and heartbeat timestamp. A stale running record is red rather than quietly becoming yellow.

## Authority boundary

The reducer accepts only records marked `persisted-run`. Missing or synthetic state fails red with `authoritative: false`. This is a domain contract, not yet a lease implementation: later queue and worker units must persist fencing, lease and heartbeat evidence and feed those records into this reducer.

All timestamps are canonical UTC. The UI may render them in the owner's timezone but must preserve the exact value and reason in the detail surface.
