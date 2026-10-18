# ADR-012: A separate TypeScript Web BFF for API composition

- **Status:** Accepted (Release 1 target architecture; implementation pending)
- **Recorded:** 2026-10-18
- **Scope:** Private financial web experience and its presentation-specific backend

## Context

The React/TypeScript SPA is hosted independently as static assets (ADR-010). Budget, Portfolio and FIRE are independent Go services (ADR-004); none may become a shared business orchestrator. The private financial overview may combine authorized results from several services and needs predictable partial-failure behavior. Browser sign-in with Keycloak is a separate security concern (ADR-006).

We compared browser-side aggregation, a Go BFF, a separate TypeScript/Node.js BFF, full-stack TypeScript frameworks such as Next.js, and GraphQL composition. A Go BFF would reinforce Job4j, but TypeScript better aligns the web-specific adaptation layer with the existing UI. Adopting a server-rendering framework solely for this purpose would undermine the accepted static-SPA deployment.

## Decision

- Add an **independently deployed Web BFF written in TypeScript on Node.js**. It is separate from both the static React SPA and Go business services. BFF instances should not rely on in-process-only session state; server-side session persistence is required but the store technology is undecided (ADR-013). The HTTP framework (e.g., Fastify or NestJS) is **not yet selected**.
- Route the private web application's BFF endpoints through **Traefik** (ADR-002). The BFF composes **read-only, browser-specific overview responses** and also forwards **all other private browser API calls, including writes**, to the appropriate authorized domain service (ADR-013). It has **no financial business database**, does not own business entities or compute authoritative financial values, and must not become a general-purpose domain orchestrator.
- Keep domain APIs independently usable via explicitly configured, authenticated routes for future native clients and other approved consumers (ADR-010). No frontend client is required to use Budget before Portfolio or FIRE.
- Preserve Keycloak as the central identity provider and keep **resource-level authorization within each domain service** (ADR-006). The Web BFF **is the browser-facing OIDC client**: Authorization Code + PKCE, **server-side access/refresh tokens**, an opaque Secure/HttpOnly cookie and CSRF safeguards are accepted in ADR-013. Exact cookie scope, shared session store, OAuth callbacks, refresh/logout operations and per-service delegated credentials require implementation design.
- A BFF must never authorize resources solely from user identifiers supplied by the browser. Calls to downstream services must carry a **verified, appropriately scoped security context** through a design that prevents impersonation; service-to-service delegation details are still open.
- Bound downstream calls with timeouts and cancellation. Where the product supports it, return **explicitly partial or unavailable** data with freshness/error indicators rather than converting failed reads into zero balances. Define the exact response/error contract before implementation.
- The **public engineering/observability dashboard** (ADR-011) stays on the static website using sanitized JSON exports; it does **not** require this private Web BFF.

## Architecture diagram

```mermaid
flowchart TD
    STATIC["Static React SPA<br/>TypeScript via CDN"]
    BROWSER["Web browser"]
    GW["Traefik<br/>API Gateway"]
    BFF["Web BFF<br/>TypeScript + Node.js"]
    KEY["Keycloak<br/>Identity provider"]

    subgraph DOMAIN["Independent domain services - Go"]
        B["Budget"]
        P["Portfolio"]
        F["FIRE"]
    end

    FUTURE["Native or other clients<br/>Future, optional"]

    STATIC -->|"Load static assets"| BROWSER
    BROWSER -->|"Private web API read/write<br/>Session cookie + CSRF for writes"| GW
    GW -->|"Web-specific routes"| BFF
    BFF <-->|"OIDC code/token exchange"| KEY
    BFF -->|"Server-side session state"| SESSION[("Private sessions<br/>Store TBD")]
    BFF -->|"Authorized reads/writes"| B
    BFF -->|"Authorized reads/writes"| P
    BFF -->|"Authorized reads/writes"| F
    FUTURE -.->|"Approved client API routes"| GW
    GW -.->|"Direct API access if explicitly enabled"| P

    classDef edge fill:#E7EFFF,stroke:#466FD1,color:#162B58;
    classDef service fill:#E5F5EC,stroke:#278254,color:#103B26;
    classDef optional fill:#FFF1DC,stroke:#B77D20,color:#563908;
    class STATIC,BROWSER,GW,KEY edge;
    class BFF,B,P,F service;
    class FUTURE optional;
```

The solid path is the **private browser read-composition and write-forwarding path**, not a mandatory route for other client types. Dashed paths show optional approved native API routes. The BFF uses Keycloak and server-managed sessions (ADR-013); domain services still enforce resource-level authorization. The BFF may fail without taking down the static SPA or independently running domain services.

## Consequences and verification

- Adds another service to build, deploy, monitor and secure, but centralizes UI-specific aggregation without moving financial domain logic into Traefik or Budget Service.
- Allows parallel requests, bounded response times and isolated per-service failures, preserving domain independence.
- Maintain explicit, preferably versioned API contracts; shared TypeScript types do not remove the need to validate Go API payloads at the boundary.
- Add integration tests for user isolation, missing/invalid security context, partial outages, unexpected response data, deadline propagation and disconnected clients.
- Does not select GraphQL, a mobile BFF, server-side rendering, an HTTP framework, a BFF session-store technology or the exact browser cookie/refresh/logout implementation. BFF-managed browser sessions are accepted in ADR-013.

## Related decisions

- [ADR-002: Traefik API Gateway](0002-traefik-api-gateway.md)
- [ADR-004: Independent polyglot services](0004-independent-polyglot-services.md)
- [ADR-006: Keycloak identity and service-owned authorization](0006-keycloak-identity-service-authorization.md)
- [ADR-010: Independent static SPA and future clients](0010-independent-spa-and-api-first-clients.md)
- [ADR-011: Public observability dashboard](0011-public-sanitized-observability-dashboard.md)
- [ADR-013: BFF-managed browser authentication](0013-keycloak-bff-managed-browser-sessions.md)
