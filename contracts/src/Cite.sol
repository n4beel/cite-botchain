// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title Cite
 * @notice Tiny, on-chain citation economy on BOT Chain.
 * Authors publish hash-anchored works with a citation fee.
 * When a subsequent work cites earlier works, each cited author's
 * fee is paid and credited to pending withdrawals.
 */
contract Cite {
    // -------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------
    uint256 public constant MAX_CITES = 8;
    uint256 public constant MAX_FEE = 1 ether;
    uint256 public constant MAX_TITLE = 64;
    uint256 public constant MAX_BATCH_VIEW = 50;

    // -------------------------------------------------------------
    // Custom Errors
    // -------------------------------------------------------------
    error ZeroHash();
    error AlreadyPublished(uint256 existingId);
    error EmptyTitle();
    error TitleTooLong();
    error FeeTooHigh();
    error TooManyCitations();
    error BadCitation(uint256 id);
    error WrongPayment(uint256 required);
    error NoSuchWork();
    error NothingToWithdraw();
    error TransferFailed();
    error ReentrantCall();
    error DirectDepositNotAllowed();

    // -------------------------------------------------------------
    // Types & Storage
    // -------------------------------------------------------------
    struct Work {
        address author;
        uint128 fee;
        uint64 at;
        uint32 citedBy;
        uint8 citeCount;
        bytes32 contentHash;
        string title;
    }

    uint256 public workCount;
    mapping(uint256 => Work) private _works;
    mapping(uint256 => uint256[]) private _cites;
    mapping(bytes32 => uint256) public idOfHash;
    mapping(address => uint256) public pending;
    mapping(address => uint256[]) private _authorWorks;

    bool private _locked;

    // -------------------------------------------------------------
    // Events
    // -------------------------------------------------------------
    event Published(
        uint256 indexed id,
        address indexed author,
        bytes32 indexed contentHash,
        string title,
        uint128 fee,
        uint256[] cites
    );

    event Withdrawn(address indexed author, uint256 amount);

    // -------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------
    modifier nonReentrant() {
        if (_locked) revert ReentrantCall();
        _locked = true;
        _;
        _locked = false;
    }

    // -------------------------------------------------------------
    // Mutating Functions
    // -------------------------------------------------------------

    /**
     * @notice Publishes a new hash-anchored work with optional citations to earlier works.
     * @param contentHash SHA-256 or keccak hash of the referenced content.
     * @param title Title of the work (1 to 64 bytes).
     * @param cites Array of up to 8 existing work IDs cited.
     * @param fee Citation fee charged to future citers (in wei, up to 1 ether).
     * @return id The newly assigned work ID.
     */
    function publish(
        bytes32 contentHash,
        string calldata title,
        uint256[] calldata cites,
        uint128 fee
    ) external payable returns (uint256 id) {
        if (contentHash == bytes32(0)) revert ZeroHash();
        if (idOfHash[contentHash] != 0) revert AlreadyPublished(idOfHash[contentHash]);
        if (bytes(title).length == 0) revert EmptyTitle();
        if (bytes(title).length > MAX_TITLE) revert TitleTooLong();
        if (fee > MAX_FEE) revert FeeTooHigh();
        if (cites.length > MAX_CITES) revert TooManyCitations();

        uint256 owed = 0;
        uint256 numCites = cites.length;

        for (uint256 i = 0; i < numCites; i++) {
            uint256 cId = cites[i];
            if (cId == 0 || cId > workCount) revert BadCitation(cId);

            // Ensure citations are distinct
            for (uint256 j = 0; j < i; j++) {
                if (cites[j] == cId) revert BadCitation(cId);
            }

            Work storage cited = _works[cId];
            if (cited.author != msg.sender) {
                owed += cited.fee;
            }
        }

        if (msg.value != owed) revert WrongPayment(owed);

        id = ++workCount;
        idOfHash[contentHash] = id;

        _works[id] = Work({
            author: msg.sender,
            fee: fee,
            at: uint64(block.timestamp),
            citedBy: 0,
            // casting to uint8 is safe because numCites <= MAX_CITES (8)
            // forge-lint: disable-next-line(unsafe-typecast)
            citeCount: uint8(numCites),
            contentHash: contentHash,
            title: title
        });

        _authorWorks[msg.sender].push(id);

        for (uint256 i = 0; i < numCites; i++) {
            uint256 cId = cites[i];
            _cites[id].push(cId);
            _works[cId].citedBy += 1;

            Work storage cited = _works[cId];
            if (cited.author != msg.sender && cited.fee > 0) {
                pending[cited.author] += cited.fee;
            }
        }

        emit Published(id, msg.sender, contentHash, title, fee, cites);
    }

    /**
     * @notice Withdraws accrued citation fees to caller's wallet via pull payment.
     */
    function withdraw() external nonReentrant {
        uint256 amount = pending[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pending[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    // -------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------

    /**
     * @notice Computes required ETH/BOT payment to publish citing the given works.
     * Citing own works is free (costs 0).
     * @param cites Array of work IDs to cite.
     * @param author Publishing author address.
     * @return owed Required payment in wei.
     */
    function quote(uint256[] calldata cites, address author) external view returns (uint256 owed) {
        if (cites.length > MAX_CITES) revert TooManyCitations();
        uint256 numCites = cites.length;

        for (uint256 i = 0; i < numCites; i++) {
            uint256 cId = cites[i];
            if (cId == 0 || cId > workCount) revert BadCitation(cId);

            for (uint256 j = 0; j < i; j++) {
                if (cites[j] == cId) revert BadCitation(cId);
            }

            Work storage cited = _works[cId];
            if (cited.author != author) {
                owed += cited.fee;
            }
        }
    }

    /**
     * @notice Reads metadata for a specific work ID.
     */
    function workOf(uint256 id) external view returns (Work memory) {
        if (id == 0 || id > workCount) revert NoSuchWork();
        return _works[id];
    }

    /**
     * @notice Returns array of work IDs cited by the given work ID.
     */
    function citesOf(uint256 id) external view returns (uint256[] memory) {
        if (id == 0 || id > workCount) revert NoSuchWork();
        return _cites[id];
    }

    /**
     * @notice Reads a batch of latest published works in reverse chronological order.
     * @param offset Number of latest works to skip.
     * @param count Maximum number of works to return (capped at 50).
     */
    function latest(
        uint256 offset,
        uint256 count
    ) external view returns (Work[] memory list, uint256[] memory ids) {
        if (count > MAX_BATCH_VIEW) count = MAX_BATCH_VIEW;
        if (workCount == 0 || offset >= workCount) {
            return (new Work[](0), new uint256[](0));
        }

        uint256 available = workCount - offset;
        uint256 n = count > available ? available : count;

        list = new Work[](n);
        ids = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            uint256 wId = workCount - offset - i;
            list[i] = _works[wId];
            ids[i] = wId;
        }
    }

    /**
     * @notice Returns array of work IDs published by a specific author.
     */
    function byAuthor(address author) external view returns (uint256[] memory) {
        return _authorWorks[author];
    }

    // -------------------------------------------------------------
    // Rejection of Raw BOT Transfers
    // -------------------------------------------------------------
    receive() external payable {
        revert DirectDepositNotAllowed();
    }

    fallback() external payable {
        revert DirectDepositNotAllowed();
    }
}
