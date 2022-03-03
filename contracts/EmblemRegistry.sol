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

    // custom API for looking up badge winners. Tokens are minted to _balances mapping when winners opt in
    mapping(uint256 => mapping(address => bool)) public _souls;
    // maps BadgeDefinitionNumber to registries of winners (1 if badge has been won, 0 if not)
    mapping(uint256 => mapping(address => uint256)) private _balances;

    constructor(address _fxChild) FxBaseChildTunnel(_fxChild) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // sets non-transferable erc20 balance to 1 if soul has been unfurled
    function mint(
        EmblemLibrary.BadgeStruct calldata badgeStruct
    ) public {
        require(_souls[badgeStruct.badgeDefinitionNumber][badgeStruct.winner] == true, "Soul has not been unfurled");
        _balances[badgeStruct.badgeDefinitionNumber][badgeStruct.winner] = 1;
    }

    // sets non-transferable erc20 balances to 1 if souls have been unfurled (batches of 16)
    function mintBatch(
        EmblemLibrary.BadgeStruct[16] calldata badgeStructs
    ) public {

        for (uint i = 0; i < 16; i++) {
            require(_souls[badgeStructs[i].badgeDefinitionNumber][badgeStructs[i].winner] == true, "Badge has not been unfurled");
            _balances[badgeStructs[i].badgeDefinitionNumber][badgeStructs[i].winner] = 1;
        }
    }

    // issues non-transferable soul if merkle proof passes
    function unfurlSoul(
        EmblemLibrary.BadgeStruct calldata badgeStruct,
        bytes32[][16] memory proof,
        uint256[][16] memory positions,
        bytes32 merkleRoot
    ) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not EmblemRegistry admin");
        require(_merkleRoots[merkleRoot] == true, "Merkle root not found");
        require (EmblemLibrary.verify(badgeStruct, proof, positions, merkleRoot), "Invalid merkle proof");
        _souls[badgeStruct.badgeDefinitionNumber][badgeStruct.winner] = true;
    }

    // issues non-transferable souls in batches of 16 if merkle proofs pass
    function unfurlSoulBatch(
        EmblemLibrary.BadgeStruct[16] calldata badgeStructs,
        bytes32[][16] memory proofs,
        uint256[][16] memory positions,
        bytes32 merkleRoot
    ) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not EmblemRegistry admin");
        require(_merkleRoots[merkleRoot] == true, "Merkle root not found");

        for (uint i = 0; i < 16; i++) {
            require (EmblemLibrary.verify(badgeStructs[i], proofs[i], positions[i], merkleRoot), "Invalid merkle proof");
            _souls[badgeStructs[i].badgeDefinitionNumber][badgeStructs[i].winner] = true;
        }
    }

    function burn(
        address winner,
        uint256 badgeDefinitionNumber
    ) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not EmblemRegistry admin");
        _balances[badgeDefinitionNumber][winner] = 0;
    }

    function hasSoul(
        uint256 badgeDefinitionId,
        address account
    ) public view returns (bool) {
        return _souls[badgeDefinitionId][account];
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
