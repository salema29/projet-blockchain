const CONTRACT_ABI = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextElectionId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasVoted",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createElection",
    inputs: [
      { name: "title", type: "string" },
      { name: "description", type: "string" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "proposalNames", type: "string[]" },
    ],
    outputs: [{ name: "electionId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addProposal",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "name", type: "string" },
    ],
    outputs: [{ name: "proposalId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "vote",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "proposalId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "finalizeElection",
    inputs: [{ name: "electionId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "statusOf",
    inputs: [{ name: "electionId", type: "uint256" }],
    outputs: [{ name: "status", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getElectionCount",
    inputs: [],
    outputs: [{ name: "count", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getElection",
    inputs: [{ name: "electionId", type: "uint256" }],
    outputs: [
      {
        name: "electionData",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "title", type: "string" },
          { name: "description", type: "string" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "proposalCount", type: "uint256" },
          { name: "totalVotes", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "finalized", type: "bool" },
          { name: "winnerProposalId", type: "uint256" },
          { name: "tie", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getProposal",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "proposalId", type: "uint256" },
    ],
    outputs: [
      {
        name: "proposalData",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "name", type: "string" },
          { name: "voteCount", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getProposals",
    inputs: [{ name: "electionId", type: "uint256" }],
    outputs: [
      {
        name: "proposalList",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "name", type: "string" },
          { name: "voteCount", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVoterChoice",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [{ name: "proposalId", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getWinningProposal",
    inputs: [{ name: "electionId", type: "uint256" }],
    outputs: [
      { name: "winnerProposalId", type: "uint256" },
      { name: "winnerName", type: "string" },
      { name: "winningVoteCount", type: "uint256" },
      { name: "tie", type: "bool" },
      { name: "finalized", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      { name: "previousOwner", type: "address", indexed: true },
      { name: "newOwner", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ElectionCreated",
    inputs: [
      { name: "electionId", type: "uint256", indexed: true },
      { name: "title", type: "string", indexed: false },
      { name: "startTime", type: "uint256", indexed: false },
      { name: "endTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProposalAdded",
    inputs: [
      { name: "electionId", type: "uint256", indexed: true },
      { name: "proposalId", type: "uint256", indexed: true },
      { name: "name", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "VoteCast",
    inputs: [
      { name: "electionId", type: "uint256", indexed: true },
      { name: "proposalId", type: "uint256", indexed: true },
      { name: "voter", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ElectionFinalized",
    inputs: [
      { name: "electionId", type: "uint256", indexed: true },
      { name: "winnerProposalId", type: "uint256", indexed: false },
      { name: "tie", type: "bool", indexed: false },
      { name: "totalVotes", type: "uint256", indexed: false },
    ],
  },
];

const CONTRACT_ADDRESS = "0xf658B10D743509b6eEd8F19e587d79F9A6fB88C1";
