// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {Cite} from "../src/Cite.sol";

contract CiteHandler is Test {
    Cite public cite;

    address[] public authors;
    uint256 public hashNonce;

    uint256 public ghostTotalPending;
    mapping(uint256 => uint256) public ghostCitedBy;

    constructor(Cite _cite, address[] memory _authors) {
        cite = _cite;
        authors = _authors;
    }

    function publish(
        uint256 authorSeed,
        uint256 feeSeed,
        uint256 numCitesSeed,
        uint256 citesMask
    ) external {
        address author = authors[authorSeed % authors.length];
        uint128 fee = uint128(bound(feeSeed, 0, 0.5 ether));

        uint256 currentCount = cite.workCount();
        uint256 maxPossible = currentCount > 8 ? 8 : currentCount;
        uint256 numCites = bound(numCitesSeed, 0, maxPossible);

        uint256[] memory selectedCites = new uint256[](numCites);
        if (numCites > 0 && currentCount > 0) {
            // Build a pool of earlier IDs [1..currentCount]
            // Pick distinct IDs by shuffling or stride
            uint256 picked = 0;
            for (uint256 step = 0; step < currentCount && picked < numCites; step++) {
                uint256 candidate = 1 + ((citesMask + step * 31) % currentCount);
                bool alreadyIn = false;
                for (uint256 k = 0; k < picked; k++) {
                    if (selectedCites[k] == candidate) {
                        alreadyIn = true;
                        break;
                    }
                }
                if (!alreadyIn) {
                    selectedCites[picked] = candidate;
                    picked++;
                }
            }
            if (picked < numCites) {
                // Resize if couldn't pick enough distinct
                assembly {
                    mstore(selectedCites, picked)
                }
            }
        }

        uint256 required = cite.quote(selectedCites, author);
        bytes32 contentHash = keccak256(abi.encode("paper", ++hashNonce));

        vm.deal(author, author.balance + required);
        vm.prank(author);
        cite.publish{value: required}(
            contentHash,
            string(abi.encodePacked("Paper #", vm.toString(hashNonce))),
            selectedCites,
            fee
        );

        // Update ghost variables
        for (uint256 i = 0; i < selectedCites.length; i++) {
            uint256 cId = selectedCites[i];
            ghostCitedBy[cId] += 1;
            Cite.Work memory cited = cite.workOf(cId);
            if (cited.author != author && cited.fee > 0) {
                ghostTotalPending += cited.fee;
            }
        }
    }

    function withdraw(uint256 authorSeed) external {
        address author = authors[authorSeed % authors.length];
        uint256 pendingBal = cite.pending(author);
        if (pendingBal == 0) return;

        ghostTotalPending -= pendingBal;

        vm.prank(author);
        cite.withdraw();
    }
}

contract CiteInvariantTest is Test {
    Cite public cite;
    CiteHandler public handler;
    address[] public authors;

    function setUp() public {
        cite = new Cite();

        authors.push(address(0x1111));
        authors.push(address(0x2222));
        authors.push(address(0x3333));
        authors.push(address(0x4444));

        for (uint256 i = 0; i < authors.length; i++) {
            vm.deal(authors[i], 1000 ether);
        }

        handler = new CiteHandler(cite, authors);

        targetContract(address(handler));
    }

    /**
     * @notice Invariant 1: Solvency
     * Contract balance must always equal exactly the sum of pending balances.
     */
    function invariant_SolvencyAlwaysHolds() public view {
        uint256 sumPending = 0;
        for (uint256 i = 0; i < authors.length; i++) {
            sumPending += cite.pending(authors[i]);
        }
        assertEq(address(cite).balance, sumPending);
        assertEq(address(cite).balance, handler.ghostTotalPending());
    }

    /**
     * @notice Invariant 2: CitedBy Counts Match Actual Citations
     * Every work's recorded citedBy counter must strictly equal ghostCitedBy.
     */
    function invariant_CitedByCountsMatch() public view {
        uint256 totalWorks = cite.workCount();
        for (uint256 i = 1; i <= totalWorks; i++) {
            assertEq(cite.workOf(i).citedBy, handler.ghostCitedBy(i));
        }
    }
}
