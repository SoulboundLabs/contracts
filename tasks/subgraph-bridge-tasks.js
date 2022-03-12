const { MerkleTree } = require('merkletreejs')
const keccak256 = require('keccak256')
const { gql, request, GraphQLClient } = require("graphql-request");
const { 
    EMBLEM_REGISTRY_CONTRACT_NAME,
    EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME,
    getSubgraphControllerAddress,
    getRegistryAddress,
    getLibraryAddress
} = require("./address-helpers");

const EMBLEM_GQL_ENDPOINT = "https://api.studio.thegraph.com/query/2486/test/2.2.3";
const EMBLEM_EARNED_BADGE_COUNT_QUERY = gql`
    query getMerkleLeaves($startingIndex: Int, $treeSize: Int) {
        earnedBadgeCounts(first: $treeSize, skip: $startingIndex, orderBy: globalBadgeNumber) {
            earnedBadge {
                badgeWinner {
                    id
                }
                definition {
                    badgeDefinitionNumber
                }
            }
        }
    }`


task("postMerkleRootFromSubgraph", "queries an EmblemDAO subgraph for a merkle tree of BadgeAwards")
.addParam("index", "index where the tree starts")
.addParam("size", "size of tree")
.setAction(async (taskArgs) => {
    const client = new GraphQLClient(EMBLEM_GQL_ENDPOINT);
    const variables = {
        startingIndex: parseInt(taskArgs.index),
        treeSize: parseInt(taskArgs.size)
    };
    const leaves = (await client.request(EMBLEM_EARNED_BADGE_COUNT_QUERY, variables)).earnedBadgeCounts;
    const hashedLeaves = leaves.map(earnedBadgeCount => hashBadge(earnedBadgeCount.earnedBadge));
    const tree = new MerkleTree(hashedLeaves, keccak256, { sortPairs: false });
    console.log(tree.getHexRoot());
    await hre.run("postMerkleRoot", 
    { 
        merkleRoot: tree.getHexRoot(),
        startingIndex: taskArgs.index,
        treeSize: taskArgs.size
    });
});

task("unfurlMerkleRoot", "mints all badges from a tree")
.addParam("index", "index where the tree starts")
.addParam("size", "size of tree")
.setAction(async (taskArgs) => {
    const client = new GraphQLClient(EMBLEM_GQL_ENDPOINT);
    const variables = {
        startingIndex: parseInt(taskArgs.index),
        treeSize: parseInt(taskArgs.size)
    };
    const leaves = (await client.request(EMBLEM_EARNED_BADGE_COUNT_QUERY, variables)).earnedBadgeCounts;
    const hashedLeaves = leaves.map(earnedBadgeCount => hashBadge(earnedBadgeCount.earnedBadge));
    const tree = new MerkleTree(hashedLeaves, keccak256, { sortPairs: false });

    const emblemRegistryContractFactory = await ethers.getContractFactory(
        EMBLEM_REGISTRY_CONTRACT_NAME,
        {
            libraries: {
                EmblemLibrary: getLibraryAddress()
            }
        }
    );

    const registryContract = await emblemRegistryContractFactory.attach(getRegistryAddress());
    console.log("Attached to Registry contract at " + registryContract.address);

    let badgeProofs = [];
    let proofs = [];
    let positions = [];
    let i = parseInt(taskArgs.index);
    for (i; i < parseInt(taskArgs.index) + parseInt(taskArgs.size); i++) {
        proofs.push(tree.getHexProof(hashedLeaves[i]));
        positions.push(tree.getProof(hashedLeaves[i]).map(x => x.position === 'right' ? 1 : 0));

        const badgeProof = {
            winner: leaves[i].earnedBadge.badgeWinner.id,
            badgeDefinitionNumber: leaves[i].earnedBadge.definition.badgeDefinitionNumber,
            merkleProof: tree.getHexProof(hashedLeaves[i]),
            positions: tree.getProof(hashedLeaves[i]).map(x => x.position === 'right' ? true : false)
        };
        badgeProofs.push(badgeProof);

        if ((i+1) % 16 == 0 && i > 0) {
            console.log("unfurling batch: (" + (i-15) + ", " + i + ")");
            
            await registryContract.unfurlBatch(
                badgeProofs.slice(i-15, i+1),
                tree.getHexRoot()
            );
        }
    }

});

subtask("postMerkleRoot", "posts a bytes32 value to SubgraphController Contract")
.addParam("merkleRoot", "32 byte hash")
.addParam("startingIndex", "index where the tree starts")
.addParam("treeSize", "index where the tree ends")
.setAction(async (taskArgs) => {
    const subgraphControllerContract = await subgraphControllerContractFactory.attach(getSubgraphControllerAddress());
    await subgraphControllerContract.postMerkleRoot(taskArgs.merkleRoot, taskArgs.startingIndex, taskArgs.treeSize);
});

task("storeMerkleRootFromSubgraph", "queries an EmblemDAO subgraph for a merkle tree of BadgeAwards")
.addParam("index", "index where the tree starts")
.addParam("size", "size of tree")
.setAction(async (taskArgs) => {
    const client = new GraphQLClient(EMBLEM_GQL_ENDPOINT);
    const variables = {
        startingIndex: parseInt(taskArgs.index),
        treeSize: parseInt(taskArgs.size)
    };
    const leaves = (await client.request(EMBLEM_EARNED_BADGE_COUNT_QUERY, variables)).earnedBadgeCounts;
    const hashedLeaves = leaves.map(earnedBadgeCount => hashBadge(earnedBadgeCount.earnedBadge));
    const tree = new MerkleTree(hashedLeaves, keccak256, { sortPairs: false });
    console.log(tree.getHexRoot());
    await hre.run("storeMerkleRootInRegistry", 
    { 
        merkleRoot: tree.getHexRoot(),
        startingIndex: taskArgs.index,
        treeSize: taskArgs.size
    });
});

subtask("storeMerkleRootInRegistry", "stores a bytes32 value in the Registry contract for future badge unfurling")
.addParam("merkleRoot", "32 byte hash")
.addParam("startingIndex", "index where the tree starts")
.addParam("treeSize", "index where the tree ends")
.setAction(async (taskArgs) => {
    const registryContractFactory = await ethers.getContractFactory(
        EMBLEM_REGISTRY_CONTRACT_NAME,
        {
            libraries: {
                EmblemLibrary: getLibraryAddress()
            }
        }
    );
    const registryContract = await registryContractFactory.attach(getRegistryAddress());
    await registryContract.storeMerkleRoot(taskArgs.merkleRoot);
});

function hashBadge(earnedBadge) {
    let hashedBadge = ethers.utils.solidityKeccak256(
      ['address', 'int8'],
      [earnedBadge.badgeWinner.id, earnedBadge.definition.badgeDefinitionNumber]
    );
    return hashedBadge;
}



