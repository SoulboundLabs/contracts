// SPDX-License-Identifier: MIT

// import "hardhat/console.sol";

pragma solidity ^0.8.0;

library EmblemLibrary {

  struct BadgeStruct {
    address winner;
    uint8 badgeDefinitionNumber;
  }

  struct BadgeProof {
    address winner;
    uint8 badgeDefinitionNumber;
    bytes32[] merkleProof;
    bool[] positions;
  }

  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
  bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

  function verify(
    BadgeProof memory badgeProof,
    bytes32 merkleRoot
  ) public pure returns (bool) {

    return EmblemMerkleProof.verify(
      badgeProof.merkleProof, 
      badgeProof.positions, 
      merkleRoot, 
      hashBadge(badgeProof.winner, badgeProof.badgeDefinitionNumber)
    );
  }

  function hashBadge(address winner, uint8 badgeDefinitionNumber) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(winner, badgeDefinitionNumber));
  }
}

/**
 * EmblemMerkleProof is identical to OpenZeppelin's MerkleProof library with the 
 * addition of a positions array to avoid sorting
 */ 
library EmblemMerkleProof {
    /**
     * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
     * defined by `root`. For this, a `proof` must be provided, containing
     * sibling hashes on the branch from the leaf to the root of the tree. The
     * positions parameter defines sorting.
     */
    function verify(
        bytes32[] memory proof,
        bool[] memory positions,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (positions[i] == true) {
                // Hash(current computed hash + current element of the proof)
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                // Hash(current element of the proof + current computed hash)
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        // Check if the computed hash (root) is equal to the provided root
        return computedHash == root;
    }
}