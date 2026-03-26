// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./FusioToken.sol";

contract FusioEscrow is Ownable {
    enum JobStatus { Pending, Active, Completed, Failed, Disputed }
    enum FaultClass { None, WorkerFault, RequesterFault, ExternalFault, EnvironmentalFault, CredentialFault }

    struct EscrowJob {
        bytes32 jobId;
        address requester;
        address worker;
        uint256 amount;
        uint256 startedAt;
        uint256 completedAt;
        JobStatus status;
        FaultClass faultClass;
        bytes32 receiptHash;
    }

    FusioToken public token;
    address public orchestrator;
    mapping(bytes32 => EscrowJob) public jobs;

    event EscrowLocked(bytes32 indexed jobId, address requester, address worker, uint256 amount);
    event EscrowReleased(bytes32 indexed jobId, address worker, uint256 amount, bytes32 receiptHash);
    event EscrowReturned(bytes32 indexed jobId, address requester, uint256 amount, FaultClass faultClass);

    constructor(address _token, address _orchestrator) Ownable(msg.sender) {
        token = FusioToken(_token);
        orchestrator = _orchestrator;
    }

    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "Only orchestrator");
        _;
    }

    function setOrchestrator(address _orchestrator) external onlyOwner {
        orchestrator = _orchestrator;
    }

    function lockEscrow(bytes32 jobId, address worker, uint256 amount) external {
        require(jobs[jobId].status == JobStatus.Pending, "Job already exists");
        require(amount > 0, "Amount must be > 0");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        jobs[jobId] = EscrowJob({
            jobId: jobId,
            requester: msg.sender,
            worker: worker,
            amount: amount,
            startedAt: block.timestamp,
            completedAt: 0,
            status: JobStatus.Active,
            faultClass: FaultClass.None,
            receiptHash: bytes32(0)
        });

        emit EscrowLocked(jobId, msg.sender, worker, amount);
    }

    function releaseEscrow(bytes32 jobId, bytes32 receiptHash) external onlyOrchestrator {
        EscrowJob storage job = jobs[jobId];
        require(job.status == JobStatus.Active, "Job not active");

        job.status = JobStatus.Completed;
        job.completedAt = block.timestamp;
        job.receiptHash = receiptHash;

        require(token.transfer(job.worker, job.amount), "Transfer failed");
        emit EscrowReleased(jobId, job.worker, job.amount, receiptHash);
    }

    function returnEscrow(bytes32 jobId, FaultClass faultClass) external onlyOrchestrator {
        EscrowJob storage job = jobs[jobId];
        require(job.status == JobStatus.Active, "Job not active");

        job.status = JobStatus.Failed;
        job.completedAt = block.timestamp;
        job.faultClass = faultClass;

        require(token.transfer(job.requester, job.amount), "Transfer failed");
        emit EscrowReturned(jobId, job.requester, job.amount, faultClass);
    }

    function getJob(bytes32 jobId) external view returns (EscrowJob memory) {
        return jobs[jobId];
    }

    function getJobStatus(bytes32 jobId) external view returns (JobStatus) {
        return jobs[jobId].status;
    }
}
