/**
 * This project's contract ABI for Cite.
 * Hand-written and `as const` for strict end-to-end type safety with viem and wagmi.
 */
export const citeAbi = [
  // Functions
  {
    type: "function",
    name: "publish",
    inputs: [
      { name: "contentHash", type: "bytes32", internalType: "bytes32" },
      { name: "title", type: "string", internalType: "string" },
      { name: "cites", type: "uint256[]", internalType: "uint256[]" },
      { name: "fee", type: "uint128", internalType: "uint128" },
    ],
    outputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "quote",
    inputs: [
      { name: "cites", type: "uint256[]", internalType: "uint256[]" },
      { name: "author", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "owed", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "workCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "workOf",
    inputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct Cite.Work",
        components: [
          { name: "author", type: "address", internalType: "address" },
          { name: "fee", type: "uint128", internalType: "uint128" },
          { name: "at", type: "uint64", internalType: "uint64" },
          { name: "citedBy", type: "uint32", internalType: "uint32" },
          { name: "citeCount", type: "uint8", internalType: "uint8" },
          { name: "contentHash", type: "bytes32", internalType: "bytes32" },
          { name: "title", type: "string", internalType: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "citesOf",
    inputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "idOfHash",
    inputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pending",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "latest",
    inputs: [
      { name: "offset", type: "uint256", internalType: "uint256" },
      { name: "count", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      {
        name: "list",
        type: "tuple[]",
        internalType: "struct Cite.Work[]",
        components: [
          { name: "author", type: "address", internalType: "address" },
          { name: "fee", type: "uint128", internalType: "uint128" },
          { name: "at", type: "uint64", internalType: "uint64" },
          { name: "citedBy", type: "uint32", internalType: "uint32" },
          { name: "citeCount", type: "uint8", internalType: "uint8" },
          { name: "contentHash", type: "bytes32", internalType: "bytes32" },
          { name: "title", type: "string", internalType: "string" },
        ],
      },
      { name: "ids", type: "uint256[]", internalType: "uint256[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "byAuthor",
    inputs: [{ name: "author", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },

  // Events
  {
    type: "event",
    name: "Published",
    inputs: [
      { name: "id", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "author", type: "address", indexed: true, internalType: "address" },
      { name: "contentHash", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "title", type: "string", indexed: false, internalType: "string" },
      { name: "fee", type: "uint128", indexed: false, internalType: "uint128" },
      { name: "cites", type: "uint256[]", indexed: false, internalType: "uint256[]" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "author", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },

  // Custom Errors
  {
    type: "error",
    name: "ZeroHash",
    inputs: [],
  },
  {
    type: "error",
    name: "AlreadyPublished",
    inputs: [{ name: "existingId", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "error",
    name: "EmptyTitle",
    inputs: [],
  },
  {
    type: "error",
    name: "TitleTooLong",
    inputs: [],
  },
  {
    type: "error",
    name: "FeeTooHigh",
    inputs: [],
  },
  {
    type: "error",
    name: "TooManyCitations",
    inputs: [],
  },
  {
    type: "error",
    name: "BadCitation",
    inputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "error",
    name: "WrongPayment",
    inputs: [{ name: "required", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "error",
    name: "NoSuchWork",
    inputs: [],
  },
  {
    type: "error",
    name: "NothingToWithdraw",
    inputs: [],
  },
  {
    type: "error",
    name: "TransferFailed",
    inputs: [],
  },
  {
    type: "error",
    name: "ReentrantCall",
    inputs: [],
  },
  {
    type: "error",
    name: "DirectDepositNotAllowed",
    inputs: [],
  },
] as const;

export const contractAbi = citeAbi;
