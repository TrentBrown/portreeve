# Issues - tb-portreeve-apple-trust

**Feature:** `tb-portreeve-apple-trust`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-08-28

Operational task breakdown derived from the plan.

## I-1 - Version the release lifecycle and public trust policy

- **Status:** in-progress
- **Estimate:** 2d
- **Plan steps:** P1
- **Rubric criteria:** R1, R2, R7
- **Depends on:** none
- **PR:** -

Implement strict release-record schema-version dispatch, the twelve-stage v2
lifecycle, read-only v1 compatibility, and prospective public preview/stable
trust enforcement. Add positive and negative fixtures without changing
historical preview facts.

## I-2 - Build Apple trust and recovery primitives

- **Status:** in-progress
- **Estimate:** 2d
- **Plan steps:** P2
- **Rubric criteria:** R3, R4, R7
- **Depends on:** I-1
- **PR:** -

Implement injected codesign, notary, stapler, and Gatekeeper contracts with
strict parsing, finite bounds, request continuity, version immutability, and
failure-injection tests. No live credential use belongs in this issue.

## I-3 - Establish canonical signed-CLI Desktop packaging

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P3
- **Rubric criteria:** R3, R5, R7
- **Depends on:** I-1, I-2
- **PR:** -

Move the embedded executable contract from `Contents/Resources` to a flat
`Contents/Helpers` entry, preserve the authoritative signed bytes through
inside-out signing, and verify exact identity through the mounted DMG while
retaining separate ARM64/x64 artifacts.

## I-4 - Add qualification and the protected trust producer

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P4
- **Rubric criteria:** R4, R7
- **Depends on:** I-1, I-2, I-3
- **PR:** -

Separate credential-free qualification from one main-only `release-trust`
producer. Implement validated configuration, least-privilege credential
custody, intentional artifact staging, absent publication authority, and
unconditional cleanup.

## I-5 - Produce and aggregate native trust evidence

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P5
- **Rubric criteria:** R3, R5, R7
- **Depends on:** I-3, I-4
- **PR:** -

Create strict ARM64 and Intel evidence schemas and collection paths for exact
CLI, DMG, application, Apple trust, Gatekeeper, and native-smoke facts. Make
aggregation require one current document for each native architecture.

## I-6 - Seal finalization and publication boundaries

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P6
- **Rubric criteria:** R1, R2, R6, R7
- **Depends on:** I-1, I-5
- **PR:** -

Bind all generated distribution metadata and both hosted/local publishers to
the final sealed packet and publication-plan digest, preserving idempotent
recovery and disjoint Apple/publication authority.

## I-7 - Complete operator documentation and regression suites

- **Status:** open
- **Estimate:** 1d
- **Plan steps:** P7
- **Rubric criteria:** R1, R3, R4, R5, R6, R7
- **Depends on:** I-4, I-5, I-6
- **PR:** -

Update repository-owned release guidance, credential and recovery contracts,
architecture labeling, rehearsal and optional manual-install instructions, and
the focused and broad verification matrices.

## I-8 - Run protected rehearsal and complete verification

- **Status:** open
- **Estimate:** 1d
- **Plan steps:** P8
- **Rubric criteria:** R1, R2, R3, R4, R5, R6, R7, R8
- **Depends on:** I-1, I-2, I-3, I-4, I-5, I-6, I-7
- **PR:** -

From reviewed code pinned on `main`, produce and inspect the complete trusted
preview packet with both native authorities and publication disabled. Preserve
zero-public-mutation evidence; route defects through fresh sequential slices
before full feature evaluation and close-out.
