// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract FusioRegistry is Ownable {
    struct AgentRecord {
        bytes32 agentId;
        address wallet;
        uint256 registeredAt;
        bool active;
    }

    struct ReceiptRecord {
        bytes32 receiptId;
        bytes32 jobId;
        bytes32 agentId;
        bytes32 workerIdHash;
        bytes32 jobHash;
        uint256 completedAt;
        uint8 outcome;
        uint256 costAgr;
    }

    address public orchestrator;
    mapping(bytes32 => AgentRecord) public agents;
    mapping(bytes32 => ReceiptRecord) public receipts;

    event AgentRegistered(bytes32 indexed agentId, address wallet);
    event AgentDeactivated(bytes32 indexed agentId);
    event ReceiptWritten(bytes32 indexed receiptId, bytes32 indexed jobId);

    constructor(address _orchestrator) Ownable(msg.sender) {
        orchestrator = _orchestrator;
    }

    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "Only orchestrator");
        _;
    }

    function setOrchestrator(address _orchestrator) external onlyOwner {
        orchestrator = _orchestrator;
    }

    function registerAgent(bytes32 agentId, address wallet) external {
        require(agents[agentId].registeredAt == 0, "Already registered");
        agents[agentId] = AgentRecord({
            agentId: agentId,
            wallet: wallet,
            registeredAt: block.timestamp,
            active: true
        });
        emit AgentRegistered(agentId, wallet);
    }

    function deactivateAgent(bytes32 agentId) external {
        require(agents[agentId].wallet == msg.sender, "Not agent owner");
        agents[agentId].active = false;
        emit AgentDeactivated(agentId);
    }

    function isRegistered(bytes32 agentId) external view returns (bool) {
        return agents[agentId].registeredAt > 0 && agents[agentId].active;
    }

    function writeReceipt(ReceiptRecord calldata receipt) external onlyOrchestrator {
        require(receipts[receipt.receiptId].completedAt == 0, "Receipt already exists");
        receipts[receipt.receiptId] = receipt;
        emit ReceiptWritten(receipt.receiptId, receipt.jobId);
    }

    function getReceipt(bytes32 receiptId) external view returns (ReceiptRecord memory) {
        return receipts[receiptId];
    }
}
