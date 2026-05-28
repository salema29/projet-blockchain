// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// Important : fixer la version pour la reproductibilité

/// @title DecentralizedVote
/// @author Iaritina
/// @notice Manages decentralized elections with on-chain proposals and one vote per address.
/// @dev Elections close automatically when their deadline is reached.
contract DecentralizedVote {
    enum ElectionStatus {
        Scheduled,
        Active,
        Ended,
        Finalized
    }

    struct Election {
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 proposalCount;
        uint256 totalVotes;
        bool exists;
        bool finalized;
        uint256 winnerProposalId;
        bool tie;
    }

    struct Proposal {
        uint256 id;
        string name;
        uint256 voteCount;
        bool exists;
    }

    struct ElectionView {
        uint256 id;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 proposalCount;
        uint256 totalVotes;
        ElectionStatus status;
        bool finalized;
        uint256 winnerProposalId;
        bool tie;
    }

    struct ProposalView {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    address public owner;
    uint256 public nextElectionId = 1;

    mapping(uint256 => Election) private elections;
    mapping(uint256 => mapping(uint256 => Proposal)) private proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint256)) private voterChoice;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    event ElectionCreated(
        uint256 indexed electionId,
        string title,
        uint256 startTime,
        uint256 endTime
    );
    event ProposalAdded(
        uint256 indexed electionId,
        uint256 indexed proposalId,
        string name
    );
    event VoteCast(
        uint256 indexed electionId,
        uint256 indexed proposalId,
        address indexed voter
    );
    event ElectionFinalized(
        uint256 indexed electionId,
        uint256 winnerProposalId,
        bool tie,
        uint256 totalVotes
    );

    // Modifier — modificateur de comportement de fonction
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    modifier electionExists(uint256 electionId) {
        require(elections[electionId].exists, "Election does not exist");
        _;
    }

    modifier onlyBeforeStart(uint256 electionId) {
        require(
            block.timestamp < elections[electionId].startTime,
            "Election already started"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Transfers contract ownership to another address.
    /// @param newOwner The new owner address.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be the zero address");

        address previousOwner = owner;
        owner = newOwner;

        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /// @notice Creates a new election with its initial proposals.
    /// @param title The election title.
    /// @param description A short description for the election.
    /// @param startTime The timestamp when voting starts.
    /// @param endTime The timestamp when voting ends.
    /// @param proposalNames The list of proposal names available for voting.
    /// @return electionId The identifier of the newly created election.
    function createElection(
        string calldata title,
        string calldata description,
        uint256 startTime,
        uint256 endTime,
        string[] calldata proposalNames
    ) external onlyOwner returns (uint256 electionId) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(endTime > block.timestamp, "End time must be in the future");
        require(endTime > startTime, "End time must be after start time");
        require(
            proposalNames.length >= 2,
            "At least two proposals are required"
        );

        electionId = nextElectionId;
        nextElectionId++;

        Election storage election = elections[electionId];
        election.title = title;
        election.description = description;
        election.startTime = startTime;
        election.endTime = endTime;
        election.exists = true;

        emit ElectionCreated(electionId, title, startTime, endTime);

        for (uint256 i = 0; i < proposalNames.length; i++) {
            _addProposal(electionId, proposalNames[i]);
        }
    }

    /// @notice Adds a new proposal before the election starts.
    /// @param electionId The target election identifier.
    /// @param name The proposal name.
    /// @return proposalId The identifier of the newly added proposal.
    function addProposal(
        uint256 electionId,
        string calldata name
    )
        external
        onlyOwner
        electionExists(electionId)
        onlyBeforeStart(electionId)
        returns (uint256 proposalId)
    {
        proposalId = _addProposal(electionId, name);
    }

    /// @notice Casts a vote for a proposal in an active election.
    /// @param electionId The election identifier.
    /// @param proposalId The chosen proposal identifier.
    function vote(
        uint256 electionId,
        uint256 proposalId
    ) external electionExists(electionId) {
        require(
            statusOf(electionId) == ElectionStatus.Active,
            "Election is not active"
        );
        require(
            !hasVoted[electionId][msg.sender],
            "You have already voted in this election"
        );
        require(
            proposals[electionId][proposalId].exists,
            "Proposal does not exist"
        );

        hasVoted[electionId][msg.sender] = true;
        voterChoice[electionId][msg.sender] = proposalId;

        proposals[electionId][proposalId].voteCount++;
        elections[electionId].totalVotes++;

        emit VoteCast(electionId, proposalId, msg.sender);
    }

    /// @notice Finalizes an ended election and stores the result on-chain.
    /// @param electionId The election identifier.
    function finalizeElection(
        uint256 electionId
    ) external electionExists(electionId) {
        Election storage election = elections[electionId];

        require(
            block.timestamp >= election.endTime,
            "Election deadline has not been reached"
        );
        require(!election.finalized, "Election already finalized");

        (uint256 winnerProposalId, , bool tie) = _computeWinner(electionId);

        election.finalized = true;
        election.winnerProposalId = winnerProposalId;
        election.tie = tie;

        emit ElectionFinalized(
            electionId,
            winnerProposalId,
            tie,
            election.totalVotes
        );
    }

    /// @notice Returns the current status of an election.
    /// @param electionId The election identifier.
    /// @return status The current election status.
    function statusOf(
        uint256 electionId
    ) public view electionExists(electionId) returns (ElectionStatus status) {
        Election storage election = elections[electionId];

        if (election.finalized) {
            return ElectionStatus.Finalized;
        }

        if (block.timestamp < election.startTime) {
            return ElectionStatus.Scheduled;
        }

        if (block.timestamp < election.endTime) {
            return ElectionStatus.Active;
        }

        return ElectionStatus.Ended;
    }

    /// @notice Returns the number of elections created so far.
    /// @return count The total number of elections.
    function getElectionCount() external view returns (uint256 count) {
        count = nextElectionId - 1;
    }

    /// @notice Returns the public information of an election.
    /// @param electionId The election identifier.
    /// @return electionData A front-end friendly election summary.
    function getElection(
        uint256 electionId
    )
        external
        view
        electionExists(electionId)
        returns (ElectionView memory electionData)
    {
        Election storage election = elections[electionId];

        electionData = ElectionView({
            id: electionId,
            title: election.title,
            description: election.description,
            startTime: election.startTime,
            endTime: election.endTime,
            proposalCount: election.proposalCount,
            totalVotes: election.totalVotes,
            status: statusOf(electionId),
            finalized: election.finalized,
            winnerProposalId: election.winnerProposalId,
            tie: election.tie
        });
    }

    /// @notice Returns a single proposal from an election.
    /// @param electionId The election identifier.
    /// @param proposalId The proposal identifier.
    /// @return proposalData The proposal details.
    function getProposal(
        uint256 electionId,
        uint256 proposalId
    )
        external
        view
        electionExists(electionId)
        returns (ProposalView memory proposalData)
    {
        Proposal storage proposal = proposals[electionId][proposalId];
        require(proposal.exists, "Proposal does not exist");

        proposalData = ProposalView({
            id: proposal.id,
            name: proposal.name,
            voteCount: proposal.voteCount
        });
    }

    /// @notice Returns all proposals for a given election.
    /// @param electionId The election identifier.
    /// @return proposalList The list of proposals and their current vote counts.
    function getProposals(
        uint256 electionId
    )
        external
        view
        electionExists(electionId)
        returns (ProposalView[] memory proposalList)
    {
        uint256 count = elections[electionId].proposalCount;
        proposalList = new ProposalView[](count);

        for (uint256 i = 0; i < count; i++) {
            Proposal storage proposal = proposals[electionId][i + 1];
            proposalList[i] = ProposalView({
                id: proposal.id,
                name: proposal.name,
                voteCount: proposal.voteCount
            });
        }
    }

    /// @notice Returns the proposal selected by a voter in a given election.
    /// @param electionId The election identifier.
    /// @param voter The voter address.
    /// @return proposalId The chosen proposal id, or 0 if the address has not voted.
    function getVoterChoice(
        uint256 electionId,
        address voter
    ) external view electionExists(electionId) returns (uint256 proposalId) {
        return voterChoice[electionId][voter];
    }

    /// @notice Returns the current winner, even if the election was not finalized yet.
    /// @param electionId The election identifier.
    /// @return winnerProposalId The winning proposal id, or 0 if no winner can be determined.
    /// @return winnerName The winning proposal name, empty if no winner can be determined.
    /// @return winningVoteCount The number of votes received by the winner.
    /// @return tie True if multiple proposals share the highest vote count.
    /// @return finalized True if the election result has already been finalized on-chain.
    function getWinningProposal(
        uint256 electionId
    )
        external
        view
        electionExists(electionId)
        returns (
            uint256 winnerProposalId,
            string memory winnerName,
            uint256 winningVoteCount,
            bool tie,
            bool finalized
        )
    {
        (winnerProposalId, winningVoteCount, tie) = _computeWinner(electionId);
        finalized = elections[electionId].finalized;

        if (winnerProposalId != 0 && !tie) {
            winnerName = proposals[electionId][winnerProposalId].name;
        }
    }

    function _addProposal(
        uint256 electionId,
        string memory name
    ) internal returns (uint256 proposalId) {
        require(bytes(name).length > 0, "Proposal name cannot be empty");

        Election storage election = elections[electionId];
        proposalId = election.proposalCount + 1;
        election.proposalCount = proposalId;

        proposals[electionId][proposalId] = Proposal({
            id: proposalId,
            name: name,
            voteCount: 0,
            exists: true
        });

        emit ProposalAdded(electionId, proposalId, name);
    }

    function _computeWinner(
        uint256 electionId
    )
        internal
        view
        returns (uint256 winnerProposalId, uint256 winningVoteCount, bool tie)
    {
        uint256 count = elections[electionId].proposalCount;

        for (uint256 i = 1; i <= count; i++) {
            uint256 currentVoteCount = proposals[electionId][i].voteCount;

            if (currentVoteCount > winningVoteCount) {
                winningVoteCount = currentVoteCount;
                winnerProposalId = i;
                tie = false;
            } else if (
                currentVoteCount == winningVoteCount && currentVoteCount > 0
            ) {
                tie = true;
            }
        }

        if (tie) {
            winnerProposalId = 0;
        }
    }
}
