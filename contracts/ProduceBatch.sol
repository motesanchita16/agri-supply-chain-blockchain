// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ProduceBatch {

    struct Batch {
        uint id;
        string produceType;
        uint quantityKg;
        address farmer;
        string ipfsHash;
        uint timestamp;
        string status;
    }

    uint public batchCount;
    mapping(uint => Batch) public batches;

    struct StatusUpdate {
        string status;
        address updatedBy;
        uint timestamp;
    }

    mapping(uint => StatusUpdate[]) public batchHistory;

    event BatchCreated(
        uint id,
        address farmer,
        string produceType
    );

    event StatusUpdated(
        uint id,
        string status,
        address updatedBy
    );

    function createBatch(
        string memory _produceType,
        uint _quantityKg,
        string memory _ipfsHash
    ) public {

        batchCount++;

        batches[batchCount] = Batch(
            batchCount,
            _produceType,
            _quantityKg,
            msg.sender,
            _ipfsHash,
            block.timestamp,
            "Harvested"
        );

        batchHistory[batchCount].push(
            StatusUpdate(
                "Harvested",
                msg.sender,
                block.timestamp
            )
        );

        emit BatchCreated(
            batchCount,
            msg.sender,
            _produceType
        );
    }

    function updateStatus(
        uint _batchId,
        string memory _newStatus
    ) public {

        require(
            _batchId > 0 && _batchId <= batchCount,
            "Batch does not exist"
        );

        batches[_batchId].status = _newStatus;

        batchHistory[_batchId].push(
            StatusUpdate(
                _newStatus,
                msg.sender,
                block.timestamp
            )
        );

        emit StatusUpdated(
            _batchId,
            _newStatus,
            msg.sender
        );
    }

    function getHistory(
        uint _batchId
    ) public view returns (StatusUpdate[] memory) {

        return batchHistory[_batchId];
    }
}