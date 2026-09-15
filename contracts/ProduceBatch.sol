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
        bool delivered;
    }

    uint public batchCount;
    mapping(uint => Batch) public batches;

    struct StatusUpdate {
        string status;
        address updatedBy;
        uint timestamp;
    }

    mapping(uint => StatusUpdate[]) public batchHistory;

    // trust score per address - incremented only on confirmed delivery
    mapping(address => uint) public trustScore;

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

    event DeliveryConfirmed(
        uint id,
        address farmer,
        uint newTrustScore
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
            "Harvested",
            false           // delivered starts false
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

        require(
            !batches[_batchId].delivered,
            "Batch already delivered - no further updates"
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

    function confirmDelivery(uint _batchId) public {

        require(
            _batchId > 0 && _batchId <= batchCount,
            "Batch does not exist"
        );

        require(
            !batches[_batchId].delivered,
            "Already confirmed"
        );

        Batch storage b = batches[_batchId];
        b.status = "Delivered";
        b.delivered = true;

        batchHistory[_batchId].push(
            StatusUpdate(
                "Delivered",
                msg.sender,
                block.timestamp
            )
        );

        trustScore[b.farmer] += 1;

        emit StatusUpdated(_batchId, "Delivered", msg.sender);
        emit DeliveryConfirmed(_batchId, b.farmer, trustScore[b.farmer]);
    }

    function getHistory(
        uint _batchId
    ) public view returns (StatusUpdate[] memory) {

        return batchHistory[_batchId];
    }

    function getTrustScore(address _user) public view returns (uint) {
        return trustScore[_user];
    }
}
