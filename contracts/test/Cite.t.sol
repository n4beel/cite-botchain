// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {Cite} from "../src/Cite.sol";

contract ReentrantAttacker {
    Cite public cite;
    bool public attacked;
    bool public reentrancyReverted;

    constructor(Cite _cite) {
        cite = _cite;
    }

    function attack() external {
        cite.withdraw();
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            try cite.withdraw() {
                // If it succeeds, reentrancy guard failed
            } catch (bytes memory reason) {
                if (bytes4(reason) == Cite.ReentrantCall.selector) {
                    reentrancyReverted = true;
                }
            }
        }
    }
}

contract CiteTest is Test {
    Cite public cite;

    address public alice = address(0xAA1);
    address public bob = address(0xBB2);
    address public charlie = address(0xCC3);
    address public dave = address(0xDD4);

    bytes32 public hash1 = keccak256("paper-1");
    bytes32 public hash2 = keccak256("paper-2");
    bytes32 public hash3 = keccak256("paper-3");
    bytes32 public hash4 = keccak256("paper-4");

    event Published(
        uint256 indexed id,
        address indexed author,
        bytes32 indexed contentHash,
        string title,
        uint128 fee,
        uint256[] cites
    );
    event Withdrawn(address indexed author, uint256 amount);

    function setUp() public {
        cite = new Cite();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);
        vm.deal(dave, 100 ether);
    }

    // -------------------------------------------------------------
    // 1. Basic Publishing without Citations
    // -------------------------------------------------------------
    function test_PublishWithoutCitations_NoPayment() public {
        vm.prank(alice);
        uint256[] memory emptyCites = new uint256[](0);

        vm.expectEmit(true, true, true, true);
        emit Published(1, alice, hash1, "Foundational Graph Theory", 0.05 ether, emptyCites);

        uint256 id = cite.publish{value: 0}(hash1, "Foundational Graph Theory", emptyCites, 0.05 ether);
        assertEq(id, 1);
        assertEq(cite.workCount(), 1);
        assertEq(cite.idOfHash(hash1), 1);

        Cite.Work memory w = cite.workOf(1);
        assertEq(w.author, alice);
        assertEq(w.fee, 0.05 ether);
        assertEq(w.citedBy, 0);
        assertEq(w.citeCount, 0);
        assertEq(w.contentHash, hash1);
        assertEq(w.title, "Foundational Graph Theory");

        uint256[] memory authWorks = cite.byAuthor(alice);
        assertEq(authWorks.length, 1);
        assertEq(authWorks[0], 1);
    }

    // -------------------------------------------------------------
    // 2. Citation Pays Authors
    // -------------------------------------------------------------
    function test_CitationPaysAuthors() public {
        uint256[] memory emptyCites = new uint256[](0);

        // Alice publishes paper 1 with fee 0.1 ether
        vm.prank(alice);
        cite.publish(hash1, "Alice Paper", emptyCites, 0.1 ether);

        // Bob publishes paper 2 with fee 0.2 ether
        vm.prank(bob);
        cite.publish(hash2, "Bob Paper", emptyCites, 0.2 ether);

        // Charlie publishes paper 3 citing both paper 1 & paper 2
        uint256[] memory cites = new uint256[](2);
        cites[0] = 1;
        cites[1] = 2;

        uint256 quoteAmount = cite.quote(cites, charlie);
        assertEq(quoteAmount, 0.3 ether);

        vm.prank(charlie);
        uint256 id = cite.publish{value: 0.3 ether}(hash3, "Charlie Survey", cites, 0.05 ether);
        assertEq(id, 3);

        // Check pending balances
        assertEq(cite.pending(alice), 0.1 ether);
        assertEq(cite.pending(bob), 0.2 ether);
        assertEq(cite.pending(charlie), 0);
        assertEq(address(cite).balance, 0.3 ether);

        // Check citedBy counts
        assertEq(cite.workOf(1).citedBy, 1);
        assertEq(cite.workOf(2).citedBy, 1);
        assertEq(cite.workOf(3).citedBy, 0);

        // Authors withdraw
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit Withdrawn(alice, 0.1 ether);
        cite.withdraw();
        assertEq(alice.balance, aliceBefore + 0.1 ether);
        assertEq(cite.pending(alice), 0);

        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        cite.withdraw();
        assertEq(bob.balance, bobBefore + 0.2 ether);
        assertEq(cite.pending(bob), 0);

        assertEq(address(cite).balance, 0);
    }

    // -------------------------------------------------------------
    // 3. Self Citation is Free and Not Credited
    // -------------------------------------------------------------
    function test_SelfCitationIsFreeAndNotCredited() public {
        uint256[] memory emptyCites = new uint256[](0);

        // Alice publishes work 1 with fee 0.5 ether
        vm.prank(alice);
        cite.publish(hash1, "Alice Origin", emptyCites, 0.5 ether);

        // Alice publishes work 2 citing work 1
        uint256[] memory cites = new uint256[](1);
        cites[0] = 1;

        uint256 quoted = cite.quote(cites, alice);
        assertEq(quoted, 0);

        vm.prank(alice);
        uint256 id = cite.publish{value: 0}(hash2, "Alice Follow-up", cites, 0.2 ether);
        assertEq(id, 2);

        // Alice pending balance must be 0
        assertEq(cite.pending(alice), 0);
        assertEq(address(cite).balance, 0);
        assertEq(cite.workOf(1).citedBy, 1);
    }

    // -------------------------------------------------------------
    // 4. Mixed Self-Citation and External Citation
    // -------------------------------------------------------------
    function test_MixedSelfAndExternalCitation() public {
        uint256[] memory empty = new uint256[](0);

        // Alice publishes work 1 (fee 0.2 ether)
        vm.prank(alice);
        cite.publish(hash1, "Alice 1", empty, 0.2 ether);

        // Bob publishes work 2 (fee 0.3 ether)
        vm.prank(bob);
        cite.publish(hash2, "Bob 2", empty, 0.3 ether);

        // Alice publishes work 3 citing work 1 (self) and work 2 (Bob)
        uint256[] memory cites = new uint256[](2);
        cites[0] = 1;
        cites[1] = 2;

        uint256 quoted = cite.quote(cites, alice);
        assertEq(quoted, 0.3 ether); // only Bob's fee

        vm.prank(alice);
        cite.publish{value: 0.3 ether}(hash3, "Alice 3", cites, 0.1 ether);

        assertEq(cite.pending(alice), 0);
        assertEq(cite.pending(bob), 0.3 ether);
        assertEq(address(cite).balance, 0.3 ether);
    }

    // -------------------------------------------------------------
    // 5. Wrong Payment Reverts
    // -------------------------------------------------------------
    function test_WrongPaymentReverts() public {
        uint256[] memory empty = new uint256[](0);
        vm.prank(alice);
        cite.publish(hash1, "Alice 1", empty, 0.1 ether);

        uint256[] memory cites = new uint256[](1);
        cites[0] = 1;

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Cite.WrongPayment.selector, 0.1 ether));
        cite.publish{value: 0.05 ether}(hash2, "Bob 2", cites, 0.1 ether);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Cite.WrongPayment.selector, 0.1 ether));
        cite.publish{value: 0.15 ether}(hash2, "Bob 2", cites, 0.1 ether);
    }

    // -------------------------------------------------------------
    // 6. Duplicate Citation Reverts with Args ID
    // -------------------------------------------------------------
    function test_DuplicateCitationRevertsArgsId() public {
        uint256[] memory empty = new uint256[](0);
        vm.prank(alice);
        cite.publish(hash1, "Alice 1", empty, 0.05 ether);

        uint256[] memory cites = new uint256[](2);
        cites[0] = 1;
        cites[1] = 1; // duplicate

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Cite.BadCitation.selector, 1));
        cite.publish{value: 0.1 ether}(hash2, "Bob 2", cites, 0.05 ether);

        vm.expectRevert(abi.encodeWithSelector(Cite.BadCitation.selector, 1));
        cite.quote(cites, bob);
    }

    // -------------------------------------------------------------
    // 7. Unknown Citation Reverts
    // -------------------------------------------------------------
    function test_UnknownCitationReverts() public {
        uint256[] memory cites = new uint256[](1);
        cites[0] = 999; // does not exist

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Cite.BadCitation.selector, 999));
        cite.publish{value: 0}(hash1, "Bob", cites, 0.05 ether);

        vm.expectRevert(abi.encodeWithSelector(Cite.BadCitation.selector, 999));
        cite.quote(cites, bob);

        cites[0] = 0; // zero id
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Cite.BadCitation.selector, 0));
        cite.publish{value: 0}(hash1, "Bob", cites, 0.05 ether);
    }

    // -------------------------------------------------------------
    // 8. Nine Citations Reverts (Max is 8)
    // -------------------------------------------------------------
    function test_NineCitationsRevert() public {
        uint256[] memory empty = new uint256[](0);
        for (uint256 i = 1; i <= 9; i++) {
            vm.prank(alice);
            cite.publish(bytes32(i), "Work", empty, 0);
        }

        uint256[] memory nineCites = new uint256[](9);
        for (uint256 i = 0; i < 9; i++) {
            nineCites[i] = i + 1;
        }

        vm.prank(bob);
        vm.expectRevert(Cite.TooManyCitations.selector);
        cite.publish{value: 0}(keccak256("ten"), "Ten", nineCites, 0);

        vm.expectRevert(Cite.TooManyCitations.selector);
        cite.quote(nineCites, bob);
    }

    // -------------------------------------------------------------
    // 9. Duplicate Content Hash Reverts with Existing ID
    // -------------------------------------------------------------
    function test_DuplicateHashRevertsArgsId() public {
        uint256[] memory empty = new uint256[](0);
        vm.prank(alice);
        cite.publish(hash1, "First Pub", empty, 0);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Cite.AlreadyPublished.selector, 1));
        cite.publish(hash1, "Plagiarized Pub", empty, 0);
    }

    // -------------------------------------------------------------
    // 10. CitedBy Counts Accrue Accurately
    // -------------------------------------------------------------
    function test_CitedByCounts() public {
        uint256[] memory empty = new uint256[](0);
        vm.prank(alice);
        cite.publish(hash1, "Target", empty, 0.01 ether);

        uint256[] memory cites = new uint256[](1);
        cites[0] = 1;

        vm.prank(bob);
        cite.publish{value: 0.01 ether}(hash2, "Citer 1", cites, 0);
        assertEq(cite.workOf(1).citedBy, 1);

        vm.prank(charlie);
        cite.publish{value: 0.01 ether}(hash3, "Citer 2", cites, 0);
        assertEq(cite.workOf(1).citedBy, 2);

        vm.prank(dave);
        cite.publish{value: 0.01 ether}(hash4, "Citer 3", cites, 0);
        assertEq(cite.workOf(1).citedBy, 3);
    }

    // -------------------------------------------------------------
    // 11. Quote Matches Requirement Exactly
    // -------------------------------------------------------------
    function test_QuoteMatchesRequirement() public {
        uint256[] memory empty = new uint256[](0);
        vm.prank(alice);
        cite.publish(hash1, "A1", empty, 0.07 ether);
        vm.prank(bob);
        cite.publish(hash2, "B1", empty, 0.13 ether);

        uint256[] memory cites = new uint256[](2);
        cites[0] = 1;
        cites[1] = 2;

        uint256 qDave = cite.quote(cites, dave);
        assertEq(qDave, 0.20 ether);

        // Dave executes with exact quote
        vm.prank(dave);
        cite.publish{value: qDave}(hash3, "D1", cites, 0);
        assertEq(cite.pending(alice), 0.07 ether);
        assertEq(cite.pending(bob), 0.13 ether);
    }

    // -------------------------------------------------------------
    // 12. Fee Cap Enforced (<= 1 ether)
    // -------------------------------------------------------------
    function test_FeeCapEnforced() public {
        uint256[] memory empty = new uint256[](0);
        vm.prank(alice);
        vm.expectRevert(Cite.FeeTooHigh.selector);
        cite.publish(hash1, "Greedy", empty, 1.000000000000000001 ether);

        // Exactly 1 ether succeeds
        vm.prank(alice);
        cite.publish(hash1, "Acceptable", empty, 1 ether);
        assertEq(cite.workOf(1).fee, 1 ether);
    }

    // -------------------------------------------------------------
    // 13. Reentrancy in Withdraw is Blocked
    // -------------------------------------------------------------
    function test_ReentrantWithdrawBlocked() public {
        ReentrantAttacker attacker = new ReentrantAttacker(cite);
        vm.deal(address(attacker), 10 ether);

        // Alice publishes paper 1 with fee 0.5 ether
        uint256[] memory empty = new uint256[](0);
        vm.prank(alice);
        cite.publish(hash1, "Alice 1", empty, 0.5 ether);

        // Attacker publishes paper 2 (fee 0.4 ether)
        vm.prank(address(attacker));
        cite.publish(hash2, "Attacker 2", empty, 0.4 ether);

        // Bob cites Attacker's paper 2
        uint256[] memory cites = new uint256[](1);
        cites[0] = 2;
        vm.prank(bob);
        cite.publish{value: 0.4 ether}(hash3, "Bob 3", cites, 0);

        assertEq(cite.pending(address(attacker)), 0.4 ether);

        // Attacker attempts reentrant withdraw
        attacker.attack();

        assertTrue(attacker.reentrancyReverted(), "Reentrancy should revert with ReentrantCall");
        assertEq(address(attacker).balance, 10.4 ether);
        assertEq(cite.pending(address(attacker)), 0);
    }

    // -------------------------------------------------------------
    // 14. Validation Boundaries
    // -------------------------------------------------------------
    function test_InputValidations() public {
        uint256[] memory empty = new uint256[](0);

        // Zero hash
        vm.expectRevert(Cite.ZeroHash.selector);
        cite.publish(bytes32(0), "Title", empty, 0);

        // Empty title
        vm.expectRevert(Cite.EmptyTitle.selector);
        cite.publish(hash1, "", empty, 0);

        // Title too long (> 64 bytes)
        string memory longTitle = "This title is way too long to fit into sixty-four bytes on the BotChain Cite contract";
        vm.expectRevert(Cite.TitleTooLong.selector);
        cite.publish(hash1, longTitle, empty, 0);

        // Withdraw nothing
        vm.expectRevert(Cite.NothingToWithdraw.selector);
        cite.withdraw();

        // WorkOf non-existent
        vm.expectRevert(Cite.NoSuchWork.selector);
        cite.workOf(0);
        vm.expectRevert(Cite.NoSuchWork.selector);
        cite.workOf(99);

        // CitesOf non-existent
        vm.expectRevert(Cite.NoSuchWork.selector);
        cite.citesOf(0);
        vm.expectRevert(Cite.NoSuchWork.selector);
        cite.citesOf(99);

        // Direct deposit
        (bool s1, ) = address(cite).call{value: 1 ether}("");
        assertFalse(s1);
    }

    // -------------------------------------------------------------
    // 15. Latest Paging
    // -------------------------------------------------------------
    function test_LatestPaging() public {
        uint256[] memory empty = new uint256[](0);
        for (uint256 i = 1; i <= 5; i++) {
            cite.publish(bytes32(i), string(abi.encodePacked("Paper ", vm.toString(i))), empty, 0);
        }

        (Cite.Work[] memory page1, uint256[] memory ids1) = cite.latest(0, 3);
        assertEq(page1.length, 3);
        assertEq(ids1.length, 3);
        assertEq(ids1[0], 5);
        assertEq(ids1[1], 4);
        assertEq(ids1[2], 3);

        (Cite.Work[] memory page2, uint256[] memory ids2) = cite.latest(3, 10);
        assertEq(page2.length, 2);
        assertEq(ids2[0], 2);
        assertEq(ids2[1], 1);

        (Cite.Work[] memory emptyPage, ) = cite.latest(10, 5);
        assertEq(emptyPage.length, 0);
    }

    // -------------------------------------------------------------
    // 16. Fuzz: Fees Conserved (>= 256 runs)
    // -------------------------------------------------------------
    function testFuzz_FeesConserved(uint128 feeA, uint128 feeB) public {
        feeA = uint128(bound(feeA, 0, 1 ether));
        feeB = uint128(bound(feeB, 0, 1 ether));

        uint256[] memory empty = new uint256[](0);
        vm.prank(alice);
        cite.publish(hash1, "A", empty, feeA);

        vm.prank(bob);
        cite.publish(hash2, "B", empty, feeB);

        uint256[] memory cites = new uint256[](2);
        cites[0] = 1;
        cites[1] = 2;

        uint256 required = uint256(feeA) + uint256(feeB);
        vm.prank(charlie);
        cite.publish{value: required}(hash3, "C", cites, 0);

        assertEq(address(cite).balance, cite.pending(alice) + cite.pending(bob) + cite.pending(charlie));
        assertEq(cite.pending(alice), feeA);
        assertEq(cite.pending(bob), feeB);
    }

    // -------------------------------------------------------------
    // 17. Fuzz: No Cycles Guarantee (>= 256 runs)
    // -------------------------------------------------------------
    function testFuzz_NoCycles(uint8 citeIndex) public {
        uint256[] memory empty = new uint256[](0);
        vm.prank(alice);
        cite.publish(hash1, "A", empty, 0);

        vm.prank(bob);
        cite.publish(hash2, "B", empty, 0);

        // A newly published work with ID 3 can only cite 1 or 2.
        // Attempting to cite >= 3 must revert.
        uint256 targetId = bound(citeIndex, 3, 255);
        uint256[] memory badCites = new uint256[](1);
        badCites[0] = targetId;

        vm.prank(charlie);
        vm.expectRevert(abi.encodeWithSelector(Cite.BadCitation.selector, targetId));
        cite.publish(hash3, "C", badCites, 0);
    }

    // -------------------------------------------------------------
    // 18. Exact Boundary Tests (64-byte title & 8 citations)
    // -------------------------------------------------------------
    function test_Exact64ByteTitleAllowed() public {
        uint256[] memory empty = new uint256[](0);
        // String of exactly 64 ASCII bytes
        string memory exact64 = "1234567890123456789012345678901234567890123456789012345678901234";
        assertEq(bytes(exact64).length, 64);

        vm.prank(alice);
        uint256 id = cite.publish(hash1, exact64, empty, 0);
        assertEq(id, 1);
        assertEq(cite.workOf(1).title, exact64);
    }

    function test_ExactEightCitationsAllowed() public {
        uint256[] memory empty = new uint256[](0);
        for (uint256 i = 1; i <= 8; i++) {
            vm.prank(alice);
            cite.publish(bytes32(i), "Work", empty, 0);
        }

        uint256[] memory eightCites = new uint256[](8);
        for (uint256 i = 0; i < 8; i++) {
            eightCites[i] = i + 1;
        }

        uint256 q = cite.quote(eightCites, bob);
        assertEq(q, 0);

        vm.prank(bob);
        uint256 id = cite.publish(hash1, "Eight Cites Paper", eightCites, 0);
        assertEq(id, 9);
        assertEq(cite.workOf(9).citeCount, 8);
    }
}
