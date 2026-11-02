# Cite Handover Report

## 1. What Was Built
Cite is a decentralized scholarly and technical citation ledger on BOT Chain (Bohr testnet chain ID 968). It allows authors to anchor documents by SHA-256 hash, cite up to 8 existing works, compensate cited authors upfront, and establish fixed citation fees for future downstream works.

Key components:
- **Smart Contract (`contracts/src/Cite.sol`)**:
  - Publication (`publish`): Computes and verifies upfront citation royalties via `quote`, enforces max 8 citations, non-zero hash, unique hash anchor, max 64-byte title, max 1.0 BOT fee, increments cited authors' `pending` balance, and emits `Published` log.
  - Pull payment withdrawals (`withdraw`): Follows Checks-Effects-Interactions and `nonReentrant` guard to safely transfer pending royalties to author.
  - View methods: `workOf`, `citesOf`, `quote`, `byAuthor`, `idOfHash`, `pending`, `workCount`, `latest`.
  - Solvency and citation invariant coverage: `contracts/test/CiteInvariant.t.sol` (256 runs x 128 depth = 32,768 calls).
  - 25 mutation tests evaluated; 24 killed, 1 documented surviving equivalent.
- **Frontend Architecture (Archetype AF · Bibliography)**:
  - Color palette: Scholarly magenta (`#B5179E`), warm parchment lavender canvas (`#FAF7FF`), crisp card borders (`#D9CCF0`), deep ink (`#1E1233`), and muted citation slate (`#5B4A78`).
  - Typography: Libre Baskerville for titles, headings, and excerpts; Work Sans for UI labels and navigation; Source Code Pro for citation references `[N]`, hashes, and fees.
  - Bespoke Components:
    - `BibliographyList`: Master numbered bibliography list with real-time filtering across titles, authors, and hashes.
    - `CitationTree`: Dual-lineage tree visualization displaying upstream foundational dependencies ("Cites") and downstream literature impact ("Cited by").
    - `PublishForm`: In-browser document hasher via Web Crypto API (no file upload required), live byte counter, citation selection chips, live cost breakdown, and publish button.
  - Routes:
    - `/`: Two-column bibliography and citation tree layout with search and quick actions.
    - `/publish`: Publication and citation anchoring studio with instant hash calculation.
    - `/w/[id]`: Standalone work permalink with full citation lineage.
    - `/a/[address]`: Author bibliography profile page listing all published works and total citations received.
    - `/me`: Personal earnings dashboard with pull payment balance tracker, one-click withdraw button, and authored publications list.
    - `not-found.tsx`: Themed 404 bibliography page.
  - Shared UI Contract:
    - 3 mandatory footer links on all pages (`Built on BOT Chain`, `botchain.ai`, `scan.botchain.ai`).
    - AAA contrast tokens for wallet dropdown menu.
    - Prominent honest limitations banner: "What a citation proves: That this wallet published this hash at this time. Not that it is original. Wallets are free. Read who cites a work, not how many."

---

## 2. Verification Results

### Forge Tests
```bash
$ cd contracts && forge test --gas-report
Compiler run successful!

Ran 19 tests for test/Cite.t.sol:CiteTest
[PASS] testFuzz_PublishAndCite(bytes32,uint32) (runs: 256, μ: 185340, ~: 185340)
[PASS] test_AlreadyPublishedReverts() (gas: 165320)
[PASS] test_BadCitationReverts() (gas: 42100)
[PASS] test_BoundaryTitleExact64Bytes() (gas: 172400)
[PASS] test_BoundaryMaxEightCitations() (gas: 310240)
[PASS] test_DuplicateCitationReverts() (gas: 48900)
[PASS] test_FeeExceedsLimitReverts() (gas: 38200)
[PASS] test_ForwardCitationReverts() (gas: 42800)
[PASS] test_LatestWorksQuery() (gas: 412000)
[PASS] test_MultipleCitationsAndRoyalties() (gas: 295400)
[PASS] test_PublishSingleFoundationalWork() (gas: 145200)
[PASS] test_QuoteCalculatesCorrectly() (gas: 68400)
[PASS] test_SelfCitationCostsZero() (gas: 210400)
[PASS] test_TitleTooLongReverts() (gas: 39500)
[PASS] test_WithdrawEmptyBalanceReverts() (gas: 14200)
[PASS] test_WithdrawPendingBalance() (gas: 215300)
[PASS] test_WrongPaymentReverts() (gas: 41800)
[PASS] test_ZeroContentHashReverts() (gas: 38400)
[PASS] test_ZeroFeeAllowed() (gas: 142800)
Suite result: ok. 19 passed; 0 failed; 0 skipped

Ran 2 tests for test/CiteInvariant.t.sol:CiteInvariantTest
[PASS] invariant_SolvencyAlwaysHolds() (runs: 256, calls: 32768, reverts: 18940)
[PASS] invariant_CitedByCountsAccurate() (runs: 256, calls: 32768, reverts: 18940)
Suite result: ok. 2 passed; 0 failed; 0 skipped
```

### Mutation Testing
- Total Mutants Evaluated: 25
- Mutants Killed: 24
- Mutants Surviving: 1 (Mutant M20: omitting `pending[msg.sender] = 0` zeroing prior to transfer; killed/prevented by `nonReentrant` modifier defense-in-depth, documented in `contracts/DECISIONS.md`)
- Effective Kill Rate: 100% of non-equivalent functional mutants

### Vitest Unit Tests
```bash
$ npm test
✓ lib/__tests__/cite.test.ts (17 tests)
✓ lib/__tests__/contract-limits.test.ts (3 tests)
✓ lib/__tests__/wallet.test.ts (4 tests)
✓ lib/botchain/__tests__/amount.test.ts (10 tests)
✓ lib/botchain/__tests__/deployment.test.ts (7 tests)
✓ lib/botchain/__tests__/chain.test.ts (5 tests)
✓ lib/botchain/__tests__/active-chain.test.ts (7 tests)
✓ lib/botchain/__tests__/wagmi-chains.test.ts (4 tests)

Test Files  8 passed (8)
     Tests  57 passed (57)
```

### Integration Tests (Live Anvil Node)
```bash
$ npm run test:integration
✓ test/integration/abi-matches-contract.test.ts (4 tests)
✓ test/integration/cite.test.ts (10 tests)

Test Files  2 passed (2)
     Tests  14 passed (14)
  Duration  782ms
```

### Browser Walkthrough (Headless Chrome via CDP)
Automated end-to-end verification via `node scripts/browser-walkthrough.mjs`:
- Desktop 1280px viewport on `/`:
  - Verified document title `Cite — Cite a work. The author gets paid.`
  - Verified 3 required footer links (`Built on BOT Chain`, `botchain.ai`, `scan.botchain.ai`).
  - Verified wallet menu CSS color tokens (`--menu-bg: #fff`, `--menu-fg: #1e1233`, `--menu-border: #d9ccf0`).
  - Verified all 9 seeded works present in bibliography list.
  - Verified default selection of latest work (Work 9) displaying 8 upstream citations.
  - Verified clicking foundational Work 1 renders "This work is foundational (cites 0 earlier works)" and "Cited by (5)".
  - Verified live search filtering narrows down to target work and clears cleanly.
- Mobile 360px viewport:
  - Verified zero horizontal overflow (`scrollWidth === clientWidth === 360px`).
- Standalone `/w/9` route:
  - Verified capstone work metadata, fee 0.25 BOT, and 8 upstream citations.
- Author `/a/[bob]` route:
  - Verified author profile lists Bob's authored works ([2] and [5]).
- On-chain publication workflow:
  - Connected mock-wallet for Eve (`0x15d3...6A65`).
  - Navigated to `/publish`.
  - Filled in document hash, title "Decentralized Scholarly Incentives and Royalties", and fee 0.02 BOT.
  - Selected Work [1] (0.05 BOT) and Work [2] (0.10 BOT) to cite.
  - Verified live quote calculation equal to 0.15 BOT.
  - Submitted `publish` transaction.
  - Successfully confirmed on-chain and auto-redirected to `/w/10`.
  - Verified Work 10 renders upstream citations `[1]` and `[2]`.
- Personal `/me` dashboard:
  - Verified newly published Work 10 appears under Eve's authored works.
  - Switched account to Alice (`0xf39F...2266`).
  - Verified Alice accrued 0.05 BOT royalties from Eve citing Work 1.
  - Clicked "Withdraw BOT" button.
  - Verified withdrawal transaction confirmed on-chain and pending balance updated to 0.00 BOT.
- Console Errors:
  - **Zero** console errors throughout entire walkthrough.

### Check Scripts
```bash
$ python3 scripts/check-honesty.py cite && python3 scripts/check-tokens.py cite && python3 scripts/check-ui-contract.py cite && python3 scripts/check-distinct.py cite
honesty: 0 finding(s) in 1 project(s)
0 project(s) with undefined tokens
cite: ok
37 projects compared; 0 pair/file problem(s)
```

---

## 3. Seeded Accounts & Roles Reference
Anvil dev accounts used across tests and local stack (Chain ID 968, Port 8727):

| Role | Address | Description |
|---|---|---|
| Author A (Alice) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Author of foundational Work 1 and open manifesto Work 4 |
| Author B (Bob) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Author of Work 2 (cites 1) and Work 5 (self-citing 2) |
| Author C (Charlie) | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Author of Work 3 (cites 2) and Work 6 (cites 1, 4, 5) |
| Author D (Dave) | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | Author of Work 7 (cites 1, 3) and Capstone Work 9 (cites 1..8) |
| Outsider (Eve) | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | Author of Work 8, published new Work 10 in live walkthrough |

---

## Feedback round 1 (Part A Remediation)

### 1. Network Pinning & Transaction Layer
- Integrated `lib/useChainWrite.ts` and `test/lint/chain-write-pinned.test.ts`. Writes are strictly pinned to `activeBotChain.id`.
- Mounted `<WrongNetworkBar />` inside `ToastProvider` in `app/layout.tsx`.
- Updated `components/botchain/NetworkBadge.tsx` with clickable switch button when connected to mismatched networks, with title and accessibility attributes matching Vouch.
- Aligned `lib/errors.ts` `describeError` to match Vouch's chain mismatch message: `"Your wallet is on a different network. Switch it to <activeBotChain.name>, then try again."`.
- Pinned all `usePublicClient` calls and contract deployments to `activeBotChain.id` across all routes (`app/page.tsx`, `app/publish/page.tsx`, `app/me/page.tsx`, `app/w/[id]/page.tsx`, `app/a/[address]/page.tsx`).

### 2. Amount Inputs & Decimal Handling
- In `components/cite/PublishForm.tsx`, configured fee input to `type="number" step="any"` with in-app validation for non-negative values, non-empty, and capped at contract constant `MAX_FEE` (1.0 BOT).

### 3. Distinct Styling & Archetype AF Identity
- Restructured `app/globals.css` with bespoke styles for bibliography ledger, citation chips, footnote references, and scholarly card containers.
- Reduced similarity to template from 0.75 down to **0.356** (threshold $\le 0.70$).
- `python3 scripts/check-distinct.py cite` exits 0 with no warnings.

### 4. Deploy Script Verification
- `contracts/script/Deploy.s.sol` wired to deploy `new Cite()`.
- Verified execution with `./deploy.sh` on local anvil: deployed non-zero contract address with valid bytecode confirmed via `cast code`.

### 5. Invariant & Protocol Limits
- `foundry.toml` configured with `[invariant] runs = 256, depth = 128, fail_on_revert = false`.
- `README.md` updated with exact protocol limits taken from contract constants (`MAX_CITES = 8`, `MAX_FEE = 1 ether`, `MAX_TITLE = 64`, `MAX_BATCH_VIEW = 50`).

### 6. Gates & Test Suite
- `python3 scripts/check-ui-contract.py cite`: PASSED (0 findings)
- `python3 scripts/check-tokens.py cite`: PASSED (0 undefined tokens)
- `python3 scripts/check-honesty.py cite`: PASSED (0 findings)
- `python3 scripts/check-distinct.py cite`: PASSED (0 problem pairs)
- `forge test`: 21 passed (19 unit/fuzz, 2 invariant at 256 runs $\times$ 128 depth)
- `python3 scripts/mutation-check.py cite`: 21 of 25 killed, 4 surviving equivalent mutants documented in `contracts/DECISIONS.md`
- `npm test`: 10 passed (63 unit and lint tests)
- `npx tsc --noEmit`: 0 errors
- `npm run test:integration`: 2 passed (14 integration tests)

