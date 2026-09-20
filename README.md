# Threadmark

Trace a claim to the exact source lines that support it. Threadmark is an append-only provenance graph on GenLayer Studio Next. A board pins immutable GitHub file snapshots, then lets authors test proposed inferences against one to three existing nodes. A supported inference can be reused as a premise; a broken one remains visible but cannot support a later claim.

This is not a truth oracle. It establishes whether a statement follows from the pinned text, not whether that text is honest, authoritative, or complete.

## Try the live board

- Web app: [nearar22.github.io/threadmark](https://nearar22.github.io/threadmark/)

- Contract: [`0x76797B4B99E1ee3AA36E63537F0480f6DFa7af69`](https://explorer-studio-dev.genlayer.com/address/0x76797B4B99E1ee3AA36E63537F0480f6DFa7af69)
- Network: Studio Next, chain ID `61997`, RPC `https://studio-next.genlayer.com/api`
- Example board: `threadmark-demo`
- Source node: `source-intent`, pinned to [IntentLock README at commit `f8cc2d08...`](https://raw.githubusercontent.com/nearar22/intent-lock/f8cc2d08fd4a91b0450d60e065e5c507cdfd7c99/README.md), line 5, with full-file SHA-256 `9f69ecb6caed588f21c81c1874bf4d1ae50d19bc4a0b19b692d75a595248ecec`.
- Supported node: `claim-paraphrase`, an entailment of that line.
- Broken node: `claim-guarantee`, an unsupported safety guarantee.

The [deployment record](deployment.json) contains the finalized transactions for all four steps.

## What validators actually check

`pin_source` accepts only an HTTPS `raw.githubusercontent.com` URL with a full 40-character commit SHA. The selected line window is at most 12 lines. The producer fetches the file and stores its full-file digest and normalized line excerpt. An independent validator fetches it again, requires the same digest and excerpt, and checks the exact quoted words. A moved or edited source fails closed instead of silently replacing the receipt.

`derive` receives the exact parent statements and the proposed statement. A producer classifies it `ENTAILED`, `CONTRADICTED`, or `UNSUPPORTED`. Independent comparative validation accepts the classification only if it agrees with the complete parent evidence. Only `ENTAILED` becomes `SUPPORTED`. The other outcomes are retained as `BROKEN`, and the contract rejects any attempt to use them as parents.

The board owner can add up to eight authors. Node IDs are unique within a board; nodes cannot be edited or deleted. The contract enforces three-parent and six-depth limits, a 40-node board cap, and same-board ancestry. `trace` returns a node and its transitive parents.

## Reproduce locally

Requirements: Node.js, npm, Python, GenLayer SDK prerequisites, and a Studio Next account funded for test transactions. Do not put a private key in the frontend environment.

```bash
cd frontend
npm ci
cp .env.example .env
npm run lint
npm run build
npm run dev
```

Open the local app, read `threadmark-demo`, and select the three cards to inspect the pinned receipt and ancestry. Reading is public. To create a board or add nodes, connect a Studio Next wallet. The interface updates only after a transaction is successfully `FINALIZED`, not merely submitted or accepted.

For contract tests, install the pinned packages in `requirements.txt`, then run:

```bash
python -m pytest tests -q
genvm-lint lint contracts/threadmark.py --json
```

To deploy a fresh copy, set `GENLAYER_PRIVATE_KEY` in your local process environment and run `npm run deploy:contract` from `frontend`. Keep this secret out of version control. Set `CONTRACT_ADDRESS` and run `npm run smoke:contract` for a fresh demo board. The smoke script writes a board, a pinned source, a supported inference, and a broken inference, and requires finalized receipts and the expected stored state.

## Review notes

The [identity and review gate](docs/identity-and-review.md) separates tested behavior from live evidence and remaining verification. The project is distinct from a one-off citation check: its state is a reusable, append-only graph, with explicit, validator-checked propagation boundaries.

## Limits

- Source availability and GitHub ownership remain external trust assumptions. A commit SHA and digest make source bytes stable, but cannot make their author credible.
- Validator judgment is semantic, not a mathematical proof. Ambiguous or incomplete evidence should classify as unsupported.
- Supported inferences inherit the scope and limitations of their parents.
- The included demo uses a public GitHub README, not private data.
