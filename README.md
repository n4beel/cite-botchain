# Cite

Cite a work. The author gets paid.

Cite is a decentralized academic and technical citation ledger built on BOT Chain (Bohr testnet chain ID 968). Anyone can anchor a document by its SHA-256 digest, declare up to 8 earlier works it cites, pay each cited author their required citation fee up front, and set a fixed fee for subsequent authors to cite them in turn.

## What it does
- **Cryptographic Document Anchoring:** Documents are hashed locally using the standard SHA-256 algorithm via the browser's Web Crypto API. Files never leave the client; only the 32-byte digest is published on-chain.
- **Upfront Citation Royalties:** To cite earlier works, the publishing author must pay each cited author's declared citation fee at publication time (`msg.value == quote(cites)`). Self-citations to an author's own earlier works are always free.
- **Pull Payment Payouts:** Earned citation royalties accumulate safely in the smart contract's `pending` balance, protected by Checks-Effects-Interactions and `nonReentrant` reentrancy guards, and can be withdrawn by authors at any time.
- **DAG Lineage & Impact Trees:** Complete on-chain citation graph. Readers can traverse upstream to foundational works ("Cites") or downstream to subsequent literature that built upon a given work ("Cited by").
- **Fixed Citation Fees:** Authors configure a fixed fee between 0 and 1.0 BOT when publishing. Fees cannot be changed post-publication, ensuring predictable citation costs for future researchers.
- **Archetype AF · Bibliography:** Scholarly publication aesthetics featuring deep magenta (`#B5179E`), soft tinted paper canvas (`#FAF7FF`), academic borders (`#D9CCF0`), rich literary typography (`Libre Baskerville`), clean sans UI labels (`Work Sans`), and monospaced citation numerals and cryptographic hashes (`Source Code Pro`).

## What it cannot do
- **No Plagiarism or Novelty Proof:** The smart contract proves only that a specific wallet published a specific 32-byte content hash at a specific block timestamp. It does not evaluate whether the document is original, truthful, or high quality.
- **No Sybil-Proof Citation Inflation:** Anyone can generate fresh wallets and pay to cite their own works to inflate citation counts. Readers must inspect *who* cites a work, not simply the raw count.
- **Immutable Citations:** Once published, citations cannot be retracted, updated, or deleted.

## Gas Profile
Measured with Solc 0.8.23 via Foundry:

| Operation | Gas Used | Cost (BOT at 20 gwei) |
|---|---|---|
| `publish(hash, title, cites, fee)` (0 cites) | ~112,000 | ~0.0022 BOT |
| `publish(hash, title, cites, fee)` (2 cites) | ~158,000 | ~0.0032 BOT |
| `publish(hash, title, cites, fee)` (8 cites) | ~294,000 | ~0.0059 BOT |
| `withdraw()` | ~34,000 | ~0.0007 BOT |
| `workOf(id)` | View call | Free |
| `citesOf(id)` | View call | Free |
| `quote(cites, author)` | View call | Free |
| `byAuthor(author)` | View call | Free |
| `idOfHash(hash)` | View call | Free |
| `pending(author)` | View call | Free |

## Development & Local Stack

Run the local stack with 9 seeded works and multi-author citation graph (chain ID 968 on port 8727):
```bash
node scripts/local-stack.mjs
npm run dev
```

Run tests:
```bash
# Contract unit, fuzz (256 runs), and invariant suites
cd contracts && forge test --gas-report

# Frontend unit tests and typecheck
npm test
npx tsc --noEmit

# Full integration test suite on live anvil node
npm run test:integration

# Headless Chrome automated walkthrough
node scripts/browser-walkthrough.mjs
```
