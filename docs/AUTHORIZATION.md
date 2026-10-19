# Scoped authorization

DOTS-010 centralizes endpoint scopes and organization data filters for owner, admin, sales-manager
and delegated-agent principals. Every decision first checks the authenticated organization. Human
membership must be active. Unknown endpoint and method combinations fail closed.

Owner-only authority includes organization transfer, membership administration and resolution of
owner-gated approvals. Admins can manage normal settings and sales operations but cannot inherit
those owner decisions. Sales managers are limited to sales data, work and agent delegation. Agent
grants can contain only read-project, read-contact, execute-work and create-proposal scopes; every
agent request must also name resources present in the grant's explicit project, campaign and contact
filters. Missing filters, cross-tenant selectors, expiry and revocation all deny access.

The database stores expiring tenant-bound delegation grants and ensures the creating membership
belongs to the same organization. The application layer must validate the structured resource filter
before persistence and must never accept a caller-supplied organization as authority. DOTS-011 adds
PostgreSQL RLS as defense in depth; it does not replace these endpoint checks.
