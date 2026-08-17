# Verification - PR #62

**Scope:** feature-final

**Feature range:** `a8e7da6906d9200a5a8719b03f88d8ca6ee73346..f6ed321bd7d2cca5b36f51d5200928ff8de3e637`

**Slice range:** `23d88bf70b8b71b36912affd2a01c3e0e6840c68..f6ed321bd7d2cca5b36f51d5200928ff8de3e637`

## Matrix

| Category | Command or evidence | Result |
| --- | --- | --- |
| Build, typecheck, lint, and format | `bun run format && bun run check` with pinned Bun 1.3.14 | PASS |
| Full regression suite | `bun test` | PASS - 523 tests, 2,744 assertions across 111 files |
| Focused release and documentation contracts | `bun test test/release/publication.test.js test/release/documentation.test.js`; publication-only and stable/fake suites also run independently | PASS - 20 tests and 253 assertions in the combined focused run |
| Stable fail-closed path | `bun test test/release/desktop-distribution.test.js -t 'fails stable Desktop finalization closed without Apple trust evidence'` | PASS |
| Hosted end-to-end rehearsal | [workflow run 32039385981](https://github.com/TrentBrown/portreeve/actions/runs/32039385981), version `0.1.0-preview.rehearsal.62`, source `f6ed321bd7d2cca5b36f51d5200928ff8de3e637`, `publish=false` | PASS |
| Native matrix | macOS ARM64/x64 and Linux ARM64/x64 jobs build, execute, and verify promoted executables; Linux jobs include the mixed process/Docker stack | PASS - all four jobs |
| Desktop matrix | macOS ARM64/x64 jobs package, launch, inspect, mount, and verify their architecture-specific DMGs and embedded CLI identity | PASS - both jobs |
| Evidence aggregation | Native fragments aggregate, Desktop evidence joins, and distribution finalization records 13 exact artifacts | PASS |
| Downloaded candidate inspection | `bun run release:inspect --record /tmp/portreeve-release-rehearsal.lyJQnx/release-record.json` | PASS - four native targets, two DMGs, no public mutation |
| Candidate integrity | Both downloaded checksum manifests pass `shasum -a 256 -c`; generated formula and cask pass `ruby -c` | PASS |
| Publication safety | Workflow `publish` job skipped; record remains `prepared` / `unpublished`; changed-plan and fake remote guards pass | PASS |
| Public-state absence | No `v0.1.0-preview.rehearsal.62` Git tag or GitHub Release exists; no tap, update publication, or npm mutation was attempted | PASS |
| Known unrelated failures | None | PASS |

## Candidate identity

- Release ID: `portreeve-v0.1.0-preview.rehearsal.62`
- Policy: `alpha` / `preview` / `unsigned`
- Versions: server `0.1.0`, Desktop `0.1.0`, client `0.1.0`
- Publication-plan SHA-256:
  `86ccc6d71ef4e17db0bfec641fea7b74b10a1f62fa1779c2227ea7e1cffb0502`
- Recorded stages: source pinned, policy resolved, native CLI built, artifact
  digests established, native CLI verified, Desktop packaged, Desktop trust
  verified, distribution finalized.

## Result

**PASS.** The entire feature is ready for human review. This was a non-publishing
rehearsal: it proves candidate construction, verification, and inspection, but
does not exercise real GitHub Release, Homebrew tap, update-metadata, or npm
publication credentials. That public mutation remains intentionally outside this
feature-final PR until separately authorized.
