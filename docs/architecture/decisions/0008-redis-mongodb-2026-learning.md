# ADR-008: Redis and MongoDB are in the 2026 Finance Lab learning scope

- **Status:** Accepted (learning/integration goal; concrete roles accepted in ADR-015)
- **Recorded:** 2026-10-18
- **Scope:** Finance Lab Release 1 in 2026
- **Supersedes:** [ADR-005: Defer Redis until a demonstrated caching need](0005-defer-redis-until-measured-need.md)

## Context

The Job4j Senior learning reference contains lessons on Redis, MongoDB, access patterns and cache invalidation. Finance Lab is both a financial application and a practical software-engineering learning project. The earlier plan deferred Redis until a performance problem was measured; the user has explicitly revised that priority to include **Redis and MongoDB in the 2026 Finance Lab learning scope**.

## Decision

- Include **hands-on Redis and MongoDB integrations in Finance Lab by the end of 2026**, using small, isolated and testable exercises that run in the Finance Lab environment.
- Preserve [ADR-003](0003-postgresql-database-per-service.md): **PostgreSQL remains the authoritative store** for budgets, investment transactions and any durable FIRE state.
- **ADR-015 accepts the specific Release 1 integrations**, both owned by the Python Analytics Service:
  - **Redis:** optional, expiring simulation-result cache with cache-aside, versioned-input keys, invalidation/freshness safeguards and graceful cache failure.
  - **MongoDB:** private, versioned documents for explicitly saved analytical reports with owner authorization and indexing.
- Exact TTLs, schemas, retention, encryption/backup settings, security tests and outage behavior are implementation work defined by ADR-015. Neither store is required to save or retrieve core financial records.
- Keep the 2027 second release available for deeper database optimization and comparison; this decision does not imply that either technology is required for all future deployments.

## Learning-scope diagram

```mermaid
flowchart TD
    RELEASE["Finance Lab Release 1 · 2026"]
    PRIMARY[("PostgreSQL<br/>Authoritative financial records")]
    ANALYTICS["Python Analytics Service<br/>2026 focused use cases"]
    REDIS[("Redis<br/>Expiring calculation cache")]
    MONGO[("MongoDB<br/>Saved analysis reports")]

    RELEASE --> PRIMARY
    RELEASE --> ANALYTICS
    ANALYTICS -->|"Cache-aside + TTL"| REDIS
    ANALYTICS -->|"Versioned documents"| MONGO

    classDef platform fill:#E7EFFF,stroke:#466FD1,color:#162B58;
    classDef accepted fill:#E5F5EC,stroke:#278254,color:#103B26;
    classDef candidate fill:#FFF1DC,stroke:#B77D20,color:#563908;
    class RELEASE platform;
    class PRIMARY,ANALYTICS accepted;
    class REDIS,MONGO candidate;
```

Solid arrows indicate **accepted 2026 integrations**. The Redis cache and MongoDB report collection are secondary to PostgreSQL financial records, are accessible only through Analytics, and do not imply public production exposure (ADR-015).

## Consequences

- Adds measurable exercises in TTL, invalidation, cache failure, document modeling and indexes to the 2026 learning plan.
- Increases test and deployment work; these integrations must remain bounded so they do not compromise reliability or the 2026 release deadline.
- Keeps transactional finance data trustworthy and avoids inventing a premature distributed consistency model.

## References

- [Job4j Redis lesson](https://github.com/anton415/job4j_senior_lessons/blob/main/modules/4.9.8-microservices-interview/04-redis.md)
- [Job4j MongoDB lesson](https://github.com/anton415/job4j_senior_lessons/blob/main/modules/4.9.8-microservices-interview/05-nosql-mongodb.md)
- [Job4j storage selection lesson](https://github.com/anton415/job4j_senior_lessons/blob/main/modules/4.9.5-system-design/05-storage-selection.md)
- [ADR-015: Analytics Redis cache and MongoDB reports](0015-analytics-redis-cache-mongodb-reports.md)
