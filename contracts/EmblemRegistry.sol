// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@maticnetwork/fx-portal/contracts/tunnel/FxBaseChildTunnel.sol";


import {EmblemLibrary} from "./EmblemLibrary.sol";

contract EmblemRegistry is AccessControl, FxBaseChildTunnel {
    uint256 public latestStateId;
    address public latestRootMessageSender;
    bytes public latestData;

    // true if merkle root has been stored
    mapping(bytes32 => bool) public _merkleRoots;

    // API for looking up badge winners
    mapping(uint256 => mapping(address => bool)) public _badges;

    constructor(address _fxChild) FxBaseChildTunnel(_fxChild) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }


    // issues non-transferable soul if merkle proof passes
    function unfurlBadge(
        EmblemLibrary.BadgeProof calldata badgeProof,
        bytes32 merkleRoot
    ) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not EmblemRegistry admin");
        require(_merkleRoots[merkleRoot] == true, "Merkle root not found");
        require (EmblemLibrary.verify(badgeProof, merkleRoot), "Invalid merkle proof");
        _badges[badgeProof.badgeDefinitionNumber][badgeProof.winner] = true;
    }

    // issues non-transferable souls in batches of 16 if merkle proofs pass
    function unfurlSoulBatch(
        EmblemLibrary.BadgeProof[16] calldata badgeProofs,
        bytes32 merkleRoot
    ) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not EmblemRegistry admin");
        require(_merkleRoots[merkleRoot] == true, "Merkle root not found");

        for (uint i = 0; i < 16; i++) {
            require (EmblemLibrary.verify(badgeProofs[i], merkleRoot), "Invalid merkle proof");
            _badges[badgeProofs[i].badgeDefinitionNumber][badgeProofs[i].winner] = true;
        }
    }

    function _processMessageFromRoot(
        uint256 stateId,
        address sender,
        bytes memory data
    ) internal override validateSender(sender) {
        latestStateId = stateId;
        latestRootMessageSender = sender;
        latestData = data;

        _merkleRoots[abi.decode(data, (bytes32))] = true;
    }
}
