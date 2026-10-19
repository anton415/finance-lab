# ADR-009: Hybrid REST + Kafka communication, beginning with Portfolio

- **Status:** Accepted (Release 1 target architecture; implementation and verification pending)
- **Recorded:** 2026-10-18
- **Scope:** Finance Lab service communication and initial Portfolio integration events

## Context

Clients need immediate results when they record and retrieve investments. Other capabilities, such as advanced analytics, can react to portfolio changes later without blocking the original request. A synchronous dependency from Portfolio to Analytics would reduce availability and increase coupling. The Job4j ShareTrip curriculum demonstrates synchronous HTTP, Kafka, transactional outbox/inbox, and distributed-process observability.

## Decision

Adopt **hybrid synchronous REST + asynchronous Kafka** communication for Finance Lab Release 1, **starting with Portfolio Service**:

- **REST** handles direct, authorized client operations and reads. Traefik routes external API calls to independent services; internal calls do not have to traverse Traefik.
- **Portfolio Service (Go)** owns investment changes in its PostgreSQL database (ADR-003). When an investment change needs an integration event, persist the financial change **and the corresponding outbox record in one local PostgreSQL transaction**; acknowledge success only after that transaction commits.
- A separate **outbox relay** eventually publishes pending integration events to **Kafka**, which is self-hosted inside K3s under ADR-018. Kafka or Analytics unavailability must **not prevent a successfully validated Portfolio command from committing**. Pending outbox records can be published when the broker recovers; if a broker loses an **already acknowledged** message after the relay marks it published, guaranteed replay needs additional reconciliation/retention design and is an explicit restore-test scenario in ADR-019.
- A consumer, initially **Python Analytics Service** (ADR-007), can subscribe and refresh or invalidate optional derived calculations. Redis caching in Analytics (ADR-015) must use source/version-aware keys or explicit staleness behavior: **delayed Kafka delivery alone cannot guarantee cache freshness**. Core Portfolio, Budget and FIRE functionality must remain usable without the Analytics consumer.
- Treat Kafka delivery as **at least once**, with duplicate publication/consumption possible. Consumers with durable side effects must apply **idempotent processing**, typically using a persisted processed-`event_id` record (inbox/deduplication) in the **same local transaction** as the derived write, where applicable. Do not claim end-to-end exactly-once processing.
- Keep financial authorization and database ownership with the respective services (ADR-003, ADR-006). Events do not authorize subscribers to access another service's private data. A consumer calling a protected API must authenticate with narrowly scoped machine credentials or an explicitly authorized user delegation (ADR-014); user bearer tokens must not be carried in events.

**ADR-025 now specifies the initial event**: `PortfolioChanged` (`finance-lab.portfolio.changed.v1`) on `portfolio.events.v1`, partitioned by `portfolio_id`, using CloudEvents 1.0 structured JSON and producer-owned JSON Schema without a Schema Registry for Release 1. This decision **does not require** all Finance Lab interactions to be events, nor does Kafka become authoritative for financial balances and transactions. Other event workflows require their own use cases.

## Architecture diagram

```mermaid
flowchart TD
    CLIENT["Finance Lab client"]
    G["Traefik<br/>Public API gateway"]

    subgraph PORTFOLIO["Portfolio Service boundary - Go"]
        CMD["Portfolio REST handler<br/>Validate ownership and command"]
        DB[("Portfolio PostgreSQL<br/>Investment records + outbox")]
        RELAY["Outbox publisher<br/>Retry until delivered"]
        CMD -->|"One atomic local transaction"| DB
        DB -->|"Read pending outbox events"| RELAY
    end

    KAFKA[("Kafka · portfolio.events.v1<br/>CloudEvents structured JSON")]

    subgraph ANALYTICS["Analytics Service - Python"]
        CONSUMER["Event consumer<br/>Duplicate-safe processing"]
        CALC["Optional recalculation<br/>Python + Rust library"]
        CONSUMER --> CALC
    end

    CLIENT -->|"HTTPS command or read"| G
    G -->|"REST"| CMD
    RELAY -->|"Publish event (retryable)"| KAFKA
    KAFKA -->|"At-least-once delivery"| CONSUMER

    classDef edge fill:#E7EFFF,stroke:#466FD1,color:#162B58;
    classDef service fill:#E5F5EC,stroke:#278254,color:#103B26;
    classDef data fill:#FFF1DC,stroke:#B77D20,color:#563908;
    class CLIENT,G edge;
    class CMD,RELAY,CONSUMER,CALC service;
    class DB,KAFKA data;
```

This is a **logical process diagram**, not a final deployment specification. The one local transaction covers Portfolio state and its outbox only; it does **not** include Kafka or Analytics. The diagram intentionally does not suggest that Analytics must be available for a Portfolio command to complete.

## Required design and verification before implementation

1. **Implement the PortfolioChanged v1 contract selected in ADR-025**, including the producer-owned JSON Schema, topic `portfolio.events.v1`, partition key `portfolio_id`, monotonically increasing source revision and real mutation trigger. Do not equate successful portfolio commits with immediately recalculated valuations. REST OpenAPI versions are governed separately by ADR-024.
2. Include stable `event_id`, `event_type`, `occurred_at`, schema version and appropriate `correlation_id`, `causation_id` and trace propagation, based on ShareTrip observability lessons (ADR-001). **When an event carries money, use versioned exact decimal strings and explicit currency (ADR-022), not floating-point JSON numbers.** Keep payloads minimal and avoid leaking sensitive financial data or user identities into logs and public dashboards.
3. Enforce ADR-025's per-portfolio ordered publication, stable event IDs, at-least-once delivery, idempotent consumption, bounded retries, private poison-message handling and **periodic reconciliation for lost latest events**. Exact retry limits, dead-letter mechanisms, broker security and operational topology require implementation-level design.
4. Test failure after database commit but before Kafka publication, Kafka downtime, duplicate delivery, consumer downtime and eventual catch-up. Assert that committed financial records remain correct and independent of Analytics availability.
5. Monitor outbox backlog, publish failures, consumer lag and end-to-end event-processing delay; connect traces/logs via correlation context. Observability must never be required for a financial command to succeed.

## Consequences

- Supports immediate financial commands and loosely coupled asynchronous follow-up processing.
- Introduces eventual consistency for derived analytics, Kafka operations and outbox/inbox complexity.
- Provides realistic Job4j learning exercises without coupling business correctness to broker availability.

## Related decisions and learning references

- [ADR-001: Observability](0001-observability-baseline.md)
- [ADR-002: Traefik](0002-traefik-api-gateway.md)
- [ADR-003: PostgreSQL Database-per-Service](0003-postgresql-database-per-service.md)
- [ADR-006: Keycloak identity and authorization](0006-keycloak-identity-service-authorization.md)
- [ADR-007: Python Analytics + Rust](0007-python-analytics-rust-library.md)
- [ADR-014: Service-to-service security](0014-keycloak-service-to-service-security.md)
- [ADR-018: K3s-hosted Kafka and broker recovery boundaries](0018-hybrid-managed-postgresql-k3s-platform-state.md)
- [ADR-019: Disaster recovery and event reconciliation](0019-backup-recovery-objectives-drills.md)
- [ADR-015: Analytics Redis cache and MongoDB saved reports](0015-analytics-redis-cache-mongodb-reports.md)
- [ADR-022: Versioned money event values](0022-exact-decimal-money-currency-contract.md)
- [ADR-024: OpenAPI for REST, independent from events](0024-openapi-contract-first-rest-versioning.md)
- [ADR-025: CloudEvents and JSON Schema Portfolio events](0025-cloudevents-json-schema-portfolio-events.md)
- [Job4j: Asynchrony and Kafka](https://github.com/anton415/job4j_senior_lessons/blob/main/modules/4.9.3-go-sharetrip-in-microservices/09-asynchrony-and-events-kafka.md)
- [Job4j: Transactional outbox and inbox](https://github.com/anton415/job4j_senior_lessons/blob/main/modules/4.9.3-go-sharetrip-in-microservices/11-outbox-inbox-transaction.md)
