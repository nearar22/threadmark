# Threadmark: identity and review gate

## Mechanism signature

An append-only provenance graph. Immutable GitHub file snapshots form source nodes. A new inference names its exact parents; independent GenLayer validators decide whether the proposed statement follows from those parents. Only supported nodes can parent later inferences. A failed inference remains visible as a broken thread, never a verified premise.

## Distinction from earlier work

| Earlier work | Core operation | Threadmark difference |
| --- | --- | --- |
| CiteGuard / SourceSeal | Check a claim against a source or citations in one audit | Build a reusable graph of chained inferences with transitive ancestry and fail-closed propagation |
| DependencyWeaver | Compile task prerequisites | Verify evidentiary entailment, not execution order |
| IntentLock | Compare actions for semantic duplication before execution | Trace the support of claims to immutable source lines |
| MergeLedger / InvariantGate | Compare document revisions | Append new claims without rewriting or activating a document version |

## Product identity

- Product metaphor: an investigator's thread board, with pinned source strips and connected inference cards.
- Voice: concise field notes, provenance first, bounded conclusions. No generic "AI verifies everything" language.
- Inputs: source URL and line range first, then a statement that names existing parent cards.
- Results: a path back to source receipts or a visible broken thread.
- Visual grammar: dark ink, parchment, copper thread; asymmetric board and graph, not a dashboard of repeated form cards.
- Evidence story: show the exact pinned source commit and lines, the recorded digest, a supported derivation and an unsupported one.

## Readiness matrix

| Requirement | Code path | Test | Live proof | Status |
| --- | --- | --- | --- | --- |
| Pinned source identity, safe URL parsing, exact quoted lines | `pin_source`, `_url` | URL and forged-quote tests | Source tx `0x5869...30c9` FINALIZED | PASS |
| Independently checked source digest and selected excerpt | `pin_source` nondeterministic fetch/verify | Changed-source validator rejection | Pinned README digest `9f69...ecec` | PASS |
| Every derived verdict checked against exact parents and statement | `derive` comparative consensus | Validator disagreement and malformed verdict tests | Supported and broken txs both FINALIZED | PASS |
| Unauthorized, duplicate, cross-board and unsupported-parent guards | Contract lifecycle | Direct guard tests | Not all guards exercised live | PASS for tests, live unverified |
| Source-to-inference-to-inference ancestry | `trace` view | Transitive trace test | One-hop live graph only | PASS for tests, live unverified |
| Public read UI, exact receipt and finalized on-chain evidence | Frontend/deployment | Production build and browser inspection | GitHub Pages loads three live nodes and source receipt | PASS |
| Wallet write from a fresh public browser session | Transaction Kit panel | Not covered by automated test | Script writes finalized, but browser wallet path not exercised | UNVERIFIED |

## Steward remediation matrix

This matrix tracks the Sep 22 author-management request. A row remains open until its code, targeted test, and new Studio Next proof all exist.

| Steward requirement | Code path | Targeted proof | Live proof | Current status |
| --- | --- | --- | --- | --- |
| Accept the address shape actually decoded by GenVM and store one canonical representation | `_address`, `set_author`, board ownership helpers | PASS: exact sample plus address-like sender | PASS: exact sample finalized and stored lowercase | PASS |
| Reject malformed addresses before storage | `_address` and frontend validator | PASS: missing prefix, wrong length, non-hex, and zero | Invalid input blocked in the public form | LIVE PROOF PENDING |
| Compare addresses case-insensitively | Canonical lowercase storage and authorization | PASS: mixed-case add, remove, and author write | PASS: mixed-case add and lowercase remove finalized | PASS |
| Reject duplicate authors and enforce the eight-author limit | `set_author` | PASS: duplicate and ninth-author rejection | Contract tests plus deployed code match | LOCAL PASS |
| Restrict author management to the board owner | `set_author` | PASS: unauthorized add and remove | Contract tests plus deployed code match | LOCAL PASS |
| Format frontend input and show clear errors | author composer and transaction status handler | PASS: four address tests, typecheck, and production build | Public browser inspection | LIVE PROOF PENDING |
| Complete the author workflow end to end | contract, frontend, deployment record | PASS: direct lifecycle test | PASS: finalized add, remove, second-author add, and author-created node | PASS |

The contract and public read path are deployed and verified. Do not claim the public wallet-write path was tested until a fresh wallet session reaches successful FINALIZED status in the hosted UI. Portal acceptance and any points are separate review decisions.
