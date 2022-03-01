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

    // maps BadgeDefinitionNumber to registries of winners (1 if badge has been won, 0 if not)
    mapping(uint256 => mapping(address => uint256)) private _balances;

    constructor(address _fxChild) FxBaseChildTunnel(_fxChild) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function mint(
        EmblemLibrary.BadgeStruct calldata badgeStruct,
        bytes32[] memory merkleProof,
        uint256[] memory positions,
        bytes32 merkleRoot
    ) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not EmblemRegistry admin");
        require(_merkleRoots[merkleRoot] == true, "Merkle root not found");
        require(EmblemLibrary.verify(badgeStruct, merkleProof, positions, merkleRoot), "Invalid merkle proof");
        _balances[badgeStruct.badgeDefinitionNumber][badgeStruct.winner] = 1;
    }

    function burn(
        address winner,
        uint256 badgeDefinitionNumber
    ) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not EmblemRegistry admin");
        _balances[badgeDefinitionNumber][winner] = 0;
    }

    function balanceOf(
        address owner,
        uint256 id
    ) external view returns (uint256) {
        return _balances[id][owner];
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
