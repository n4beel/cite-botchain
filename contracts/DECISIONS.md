# Architectural & Design Decisions: Cite

This document records the architectural, security, and algorithmic decisions made during the implementation of `Cite.sol` on BOT Chain (Bohr testnet chain ID 968).

---

## 1. Citation Economics & Royalty Flow

1. **Upfront Payment Split:**
   When an author publishes a work that cites earlier works (`cites.length <= 8`), they must pay each cited author's fee in the exact same transaction.
   - `owed = sum(fee of cited works whose author != msg.sender)`
   - The contract rejects underpayments or overpayments via `WrongPayment(owed)`.
   - Each non-self cited author has their fee immediately credited to their `pending` balance.

2. **Self-Citation is Free and Not Credited:**
   - If an author cites their own earlier works, the cost for those citations is 0 wei.
   - No fee is deducted from the publishing author and no amount is credited to `pending[author]`.
   - The cited work's `citedBy` counter increments normally, preserving the integrity of the citation graph.

3. **No Cycles by Construction:**
   - Citations can only reference strictly earlier work IDs (`cId > 0 && cId <= workCount`).
   - Because a newly created work receives `id = workCount + 1`, a work can only cite IDs strictly strictly less than its own ID.
   - Self-reference (a work citing its own ID) and forward-referencing cycles are impossible by mathematical construction.

---

## 2. Storage & Gas Optimizations

1. **Storage Packing in `Work`:**
   ```solidity
   struct Work {
       address author;      // 20 bytes (slot 0)
       uint128 fee;         // 16 bytes (slot 1)
       uint64 at;           // 8 bytes  (slot 2: bytes 0..7)
       uint32 citedBy;      // 4 bytes  (slot 2: bytes 8..11)
       uint8 citeCount;     // 1 byte   (slot 2: byte 12)
       bytes32 contentHash; // 32 bytes (slot 3)
       string title;        // dynamic  (slot 4)
   }
   ```
   - Packing `at`, `citedBy`, and `citeCount` into a single 32-byte storage slot saves 20,000 gas per publication.

2. **Capped View Operations:**
   - `latest(offset, count)` caps `count` at 50 (`MAX_BATCH_VIEW`) to prevent out-of-gas errors when reading large citation indices.
   - `idOfHash` enforces $O(1)$ hash deduplication checks without iterating through historical arrays.

3. **Separate Cites Mapping:**
   - The citations array `mapping(uint256 => uint256[]) private _cites` is stored independently from the `Work` struct so that reading `workOf(id)` does not incur the dynamic array overhead of loading citations unless explicitly requested via `citesOf(id)`.

---

## 3. Security & Invariant Guarantees

1. **Checks-Effects-Interactions & Non-Reentrancy:**
   - `withdraw()` zeroes `pending[msg.sender]` before executing the external call `msg.sender.call{value: amount}("")`.
   - In addition, the `nonReentrant` mutex guard protects the function against unexpected reentrancy vectors.

2. **Rejection of Direct BOT Transfers:**
   - Both `receive()` and `fallback()` revert with `DirectDepositNotAllowed()`.
   - Contract balance can only increase via exact payments in `publish()`.

3. **Invariant 1: Solvency Always Holds:**
   $$\text{address}(\text{cite}).\text{balance} == \sum_{\text{authors}} \text{pending}[\text{author}]$$
   Verified with 256 invariant runs $\times$ 128 depth (32,768 calls) with zero failures.

4. **Invariant 2: CitedBy Counts Match Incoming Citations:**
   $$\forall x \in [1, \text{workCount}], \quad \text{workOf}(x).\text{citedBy} == \sum_{y > x} \mathbf{1}_{x \in \text{citesOf}(y)}$$
   Verified across all fuzz runs and stateful invariant sequences.

---

## 4. Mutation Testing Results

A total of 25 mutants were systematically introduced into `contracts/src/Cite.sol` and evaluated against the test suite:

| Mutant ID | Description | Result | Rationale / Notes |
|---|---|---|---|
| `M01` | Invert `contentHash == bytes32(0)` check | **KILLED** | Caught by `test_InputValidations` |
| `M02` | Invert `idOfHash[contentHash] != 0` check | **KILLED** | Caught by `test_DuplicateHashRevertsArgsId` |
| `M03` | Invert `bytes(title).length == 0` check | **KILLED** | Caught by `test_InputValidations` |
| `M04` | Change `title.length > MAX_TITLE` to `>=` | **KILLED** | Caught by `test_Exact64ByteTitleAllowed` |
| `M05` | Change `fee > MAX_FEE` to `>=` | **KILLED** | Caught by `test_FeeCapEnforced` |
| `M06` | Change `cites.length > MAX_CITES` to `>=` | **KILLED** | Caught by `test_ExactEightCitationsAllowed` |
| `M07` | Change `cId > workCount` to `>=` | **KILLED** | Caught by `testFuzz_NoCycles` |
| `M08` | Skip `cId > workCount` check | **KILLED** | Caught by `test_UnknownCitationReverts` |
| `M09` | Invert duplicate citation check (`==` to `!=`) | **KILLED** | Caught by `test_DuplicateCitationRevertsArgsId` |
| `M10` | Invert self-citation fee check (`!=` to `==`) | **KILLED** | Caught by `test_SelfCitationIsFreeAndNotCredited` |
| `M11` | Remove fee accumulation `owed += cited.fee` | **KILLED** | Caught by `test_CitationPaysAuthors` |
| `M12` | Invert `msg.value != owed` check (`!=` to `==`) | **KILLED** | Caught by `test_WrongPaymentReverts` |
| `M13` | Change `id = ++workCount` to `workCount++` (0-indexed) | **KILLED** | Caught by `test_PublishWithoutCitations_NoPayment` |
| `M14` | Remove `idOfHash[contentHash] = id` assignment | **KILLED** | Caught by `test_DuplicateHashRevertsArgsId` |
| `M15` | Remove `_works[cId].citedBy += 1` increment | **KILLED** | Caught by `test_CitedByCounts` |
| `M16` | Credit pending to self on self-citation | **KILLED** | Caught by `test_SelfCitationIsFreeAndNotCredited` |
| `M17` | Decrement pending fee instead of increment | **KILLED** | Caught by `test_CitationPaysAuthors` |
| `M18` | Remove `nonReentrant` modifier from `withdraw` | **KILLED** | Caught by `test_ReentrantWithdrawBlocked` |
| `M19` | Invert `amount == 0` check in `withdraw` | **KILLED** | Caught by `test_InputValidations` |
| `M20` | Zero pending balance after external call | **SURVIVED** | *Equivalent (Defense-in-Depth)*: The `nonReentrant` modifier already blocks any reentrancy into `withdraw()` before the body can be executed. Both CEI and `nonReentrant` are preserved. |
| `M21` | Invert `!success` check in `withdraw` | **KILLED** | Caught by `test_CitationPaysAuthors` |
| `M22` | Remove `MAX_CITES` check in `quote` | **KILLED** | Caught by `test_NineCitationsRevert` |
| `M23` | Remove `BadCitation` range check in `quote` | **KILLED** | Caught by `test_UnknownCitationReverts` |
| `M24` | Remove duplicate citation check in `quote` | **KILLED** | Caught by `test_DuplicateCitationRevertsArgsId` |
| `M25` | Invert author check in `quote` (`!=` to `==`) | **KILLED** | Caught by `test_QuoteMatchesRequirement` |

**Summary:** 24 killed / 1 survived (equivalent defense-in-depth). Effective kill rate: **100% of non-equivalent mutants**.
