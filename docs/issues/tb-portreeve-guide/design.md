# Design - tb-portreeve-guide

**Feature:** `tb-portreeve-guide`
**Approved:** 2026-08-10
**Status:** frozen at design gate

## Problem

PortReeve exposes powerful allocation, stack, Docker, sandbox, and launcher concepts,
but the desktop currently assumes the user already understands the product boundary.
That makes it easy to mistake PortReeve for a project-process supervisor or to treat the
built-in launcher as the only integration model. The primary navigation also names a
collection tab **Launcher** while comparable collection surfaces use plurals.

## Intent

Add a rightmost **Guide** tab that teaches the stable mental model inside the installed
desktop application. Rename the collection-level **Launcher** tab and page heading to
**Launchers**. The Guide must make the responsibility boundary and the three integration
paths obvious without acquiring live state, mutation authority, or a new dependency.

## Chosen shape

The desktop navigation becomes **Overview → Ports → Stacks → Launchers → Guide**.
Internal identifiers and one-launcher labels remain unchanged.

The Guide is static renderer markup with three layers:

1. A concise orientation describing the single per-user PortReeve authority.
2. Three integration-path cards labeled Good, Better, and Best.
3. A responsive semantic architecture flow plus grouped native `<details>` deep dives.

The architecture rendition visually separates:

- human-facing and programmatic PortReeve interfaces;
- the one per-user server, registry, and native supervisor;
- project-owned definitions, launchers, processes, containers, and sandbox snapshots;
- host and Docker evidence consulted by PortReeve.

The central message is: **PortReeve coordinates addresses; project tools coordinate
work.** PortReeve may confirm that the expected process or container owns a listener,
but it does not assert that the application is healthy or ready.

## Integration paths

### Good — Built-in driver

The desktop wraps existing start, stop, restart, and status commands, injects the
selected stack's resolved endpoints, bounds command behavior, and compares results with
independent evidence. This is the lowest-friction experiment, but using it requires the
desktop application.

### Better — Generated launcher

PortReeve can help generate a separate launcher application or library. The resulting
tool runs independently of the desktop and uses the server, but it remains an additional
integration artifact that the project owns and maintains.

### Best — Native integration

The project's existing service-management code calls the PortReeve server through the
official client or common protocol. The project retains complete lifecycle control and
depends only on the PortReeve authority and its chosen client/protocol binding.

## Trust and implementation boundary

- No main-process, preload, IPC, client, server, protocol, storage, or schema change.
- No renderer network request, arbitrary link, or external content.
- No runtime diagram or documentation dependency.
- The new tab participates in the existing dirty stack and launcher editor navigation
  guards.
- The Guide remains useful when the server is absent or status evidence is stale.
- Existing CSP, packaging, sandbox, and context-isolation guarantees remain unchanged.

## Accessibility and responsive behavior

The tab is a native button like the existing tabs. The Guide uses headings, articles,
ordered relationships, and native disclosures so its meaning is available without a
visual-only image. CSS converts the architecture to a single readable column at narrow
desktop widths. Focus behavior follows the existing theme.

## Non-goals

- Live architecture status, service controls, or troubleshooting automation.
- Exhaustive CLI flags, protocol schemas, or API reference material.
- Generating a standalone launcher in this slice.
- Altering launcher execution behavior.
- Adding external documentation navigation.

## Changes

Append approved amendments here. Do not remove or weaken the frozen design.
