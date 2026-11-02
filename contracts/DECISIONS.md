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

Evaluated via `python3 scripts/mutation-check.py cite`:
- **Evaluated**: 25 mutants tested
- **Killed**: 21 mutants killed
- **Surviving**: 4 equivalent mutants (100% of functional mutants killed)

Surviving equivalent mutants documented:
1. `Cite.sol:151 if (cited.author != msg.sender && cited.fee > 0)` $\to$ `fee >= 0`:
   `fee` is a non-negative `uint128`. When `fee == 0`, executing `authorDues[cited.author] += 0` is an arithmetic identity no-op.
2. `Cite.sol:235 uint256 n = count > available ? available : count;` $\to$ `count >= available`:
   When `count == available`, both branches evaluate to `available`.
3. `Cite.sol:229 if (count > MAX_BATCH_VIEW) count = MAX_BATCH_VIEW;` $\to$ `count >= MAX_BATCH_VIEW`:
   When `count == MAX_BATCH_VIEW`, assigning `MAX_BATCH_VIEW` is an identity assignment.
4. `Cite.sol:230 if (workCount == 0 || offset >= workCount)` $\to$ `offset > workCount`:
   When `offset == workCount`, `available = workCount - offset = 0`, producing `n = 0` and an identical empty dynamic return array.
