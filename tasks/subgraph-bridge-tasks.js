const { MerkleTree } = require('merkletreejs')
const keccak256 = require('keccak256')
const { gql, request, GraphQLClient } = require("graphql-request");
require("isomorphic-fetch");
const { 
    EMBLEM_REGISTRY_CONTRACT_NAME,
    EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME,
    getSubgraphControllerAddress,
    getRegistryAddress,
    getLibraryAddress
} = require("./address-helpers");

const EMBLEM_GQL_ENDPOINT = "https://api.studio.thegraph.com/query/2486/test/2.2.3";
const EMBLEM_DECENTRALIZED_GQL_ENDPOINT = "https://gateway.thegraph.com/api/003ad7b617f9ce7f352c3c6ef7085269/subgraphs/id/BKWqzRUajb4zK3X8LwwEACH2tVgprgEE8ZdsHdknxQEk";

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

task("logAttestationCIDs", "fetches the first EarnedBadge entity and logs the request+response CID's from the attestation.")
.setAction(async () => {

    const queryString = "{earnedBadges(first:1,block:{hash:\"0x018dbfdbc6cfcbc380b164b779e8297a01faf5903ba89e06950c900cd767cde3\"}){id}}";
    const query = JSON.stringify({ query: queryString, variables: {} });
    const badgeRequest = new Request(EMBLEM_DECENTRALIZED_GQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        variables: {},
        body: query
    });

    var attestation = "";
    await fetch(badgeRequest)
    .then(response => {
        attestation = JSON.parse(response.headers.get('graph-attestation'));
        return response.text();
    })
    .then(text => {
        console.log("request: " + query.toString());
        console.log("expected attestation requestCID: " + keccak256(query.toString()).toString('hex'));
        console.log("actual attestation requestCID: " + attestation.requestCID);
        console.log("\nresponse: " + text);
        console.log("expected attestation responseCID: " + keccak256(text).toString('hex'));
        console.log("actual attestation responseCID: " + attestation.responseCID);
    });
});

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



