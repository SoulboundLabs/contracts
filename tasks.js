const { MerkleTree } = require('merkletreejs')
const keccak256 = require('keccak256')
const { gql, request, GraphQLClient } = require("graphql-request");

const { SoulboundAddresses } = require('./addresses.json');
const EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME = "EmblemSubgraphController";
const EMBLEM_LIBRARY_CONTRACT_NAME = "EmblemLibrary";
const EMBLEM_REGISTRY_CONTRACT_NAME = "EmblemRegistry";


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



subtask("deploySubgraphControllerWithFx", "Deploys SubgraphController contract")
.addParam("checkpointManager", "address of checkpoint manager for polygon bridge communication")
.addParam("fxRoot", "address of fxRoot used for polygon bridge communication")
.setAction(async (taskArgs) => {
    const subgraphControllerContractFactory = await ethers.getContractFactory(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
    const subgraphControllerContract = await subgraphControllerContractFactory.deploy(taskArgs.checkpointManager, taskArgs.fxRoot);
    await subgraphControllerContract.deployed();
    console.log("SubgraphController contract deployed to: " + subgraphControllerContract.address);
});

subtask("deployRegistryWithFx", "Deploys Registry contract intended for layer 2")
.addParam("fxChild", "address of fxChild for polygon bridge communication")
.setAction(async (taskArgs) => {
    const emblemLibraryContractFactory = await ethers.getContractFactory(EMBLEM_LIBRARY_CONTRACT_NAME);
    const emblemLibraryContract = await emblemLibraryContractFactory.deploy();
    await emblemLibraryContract.deployed();

    console.log("Library contract deployed to: " + emblemLibraryContract.address);

    const emblemRegistryContractFactory = await ethers.getContractFactory(
        EMBLEM_REGISTRY_CONTRACT_NAME,
        {
            libraries: {
                EmblemLibrary: emblemLibraryContract.address
            }
        }
    );
    const emblemRegistryContract = await emblemRegistryContractFactory.deploy(taskArgs.fxChild);
    await emblemRegistryContract.deployed();

    console.log("Registry contract deployed to: " + emblemRegistryContract.address);
});

subtask("setChildTunnelMapping", "Points SubgraphController at Registry contract for bridged communication")
.addParam("subgraphControllerAddress", "address of Subgraph Controller contract")
.addParam("registryContractAddress", "address of Registry contract intended for layer 2")
.setAction(async (taskArgs) => {
    const subgraphControllerContractFactory = await ethers.getContractFactory(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
    const subgraphControllerContract = await subgraphControllerContractFactory.attach(taskArgs.subgraphControllerAddress);
    console.log("Attached to SubgraphControllerContract at " + subgraphControllerContract.address);

    await subgraphControllerContract.setFxChildTunnel(taskArgs.registryContractAddress);
});


subtask("setRootTunnelMapping", "Points Registry contract at SubgraphController")
.addParam("subgraphControllerAddress", "address of Subgraph Controller contract")
.addParam("registryContractAddress", "address of Registry contract intended for layer 2")
.addParam("libraryAddress", "address of library used by Registry contract")
.setAction(async (taskArgs) => {

    const emblemRegistryContractFactory = await ethers.getContractFactory(
        EMBLEM_REGISTRY_CONTRACT_NAME,
        {
            libraries: {
                EmblemLibrary: taskArgs.libraryAddress
            }
        }
    );

    const registryContract = await emblemRegistryContractFactory.attach(taskArgs.registryContractAddress);
    console.log("Attached to Registry contract at " + registryContract.address);

    await registryContract.setFxRootTunnel(taskArgs.subgraphControllerAddress);
});


task("deploySubgraphController", "Deploys SubgraphController contract with Goerli-Mumbai polygon bridge initialization")
.setAction(async() => {
    const polygonAddresses = getPolygonFxRootAddresses();

    await hre.run("deploySubgraphControllerWithFx",
    {
        checkpointManager: polygonAddresses[0],
        fxRoot: polygonAddresses[1]
    });
});

task("deployRegistry", "Deploys SubgraphController contract with Mumbai->Goerli polygon bridge initialization")
.setAction(async() => {
    const fxChild = getPolygonFxChild();
    await hre.run("deployRegistryWithFx",
    {
        fxChild: fxChild
    });
});


task("setTunnelMapping", "Points contracts from different networks at eachother")
.setAction(async () => {
    const subgraphControllerAddress = getSubgraphControllerAddress

    if (hre.network.name == "mumbai") {
        await hre.run("setRootTunnelMapping",
        {
            subgraphControllerAddress: SoulboundAddresses.SubgraphController.goerli,
            registryContractAddress: getRegistryAddress(),
            libraryAddress: getLibraryAddress()
        });
    }
    else if (hre.network.name == "goerli") {
        await hre.run("setChildTunnelMapping", 
        { 
          subgraphControllerAddress: getSubgraphControllerAddress(),
          registryContractAddress: SoulboundAddresses.Registry.mumbai
        });
    }
    else {
        console.log("task doesn't support network: " + hre.network.name);
    }
});

subtask("postMerkleRoot", "posts a bytes32 value to SubgraphController Contract")
.addParam("merkleRoot", "32 byte hash")
.addParam("startingIndex", "index where the tree starts")
.addParam("treeSize", "index where the tree ends")
.setAction(async (taskArgs) => {
    if (hre.network.name == "goerli") {
        const subgraphControllerContractFactory = await ethers.getContractFactory(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
        const subgraphControllerContract = await subgraphControllerContractFactory.attach(EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI);
        await subgraphControllerContract.postMerkleRoot(taskArgs.merkleRoot, taskArgs.startingIndex, taskArgs.treeSize);
    } else {
        console.log("no SubgraphController found on network: " + hre.network.name);
    }
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

function hashBadge(earnedBadge) {
    let hashedBadge = ethers.utils.solidityKeccak256(
      ['address', 'int8'],
      [earnedBadge.badgeWinner.id, earnedBadge.definition.badgeDefinitionNumber]
    );
    return hashedBadge;
}

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

    if (hre.network.name == "mumbai") {
        const emblemRegistryContractFactory = await ethers.getContractFactory(
            EMBLEM_REGISTRY_CONTRACT_NAME,
            {
                libraries: {
                    EmblemLibrary: EMBLEM_LIBRARY_ADDRESS_MUMBAI
                }
            }
        );

        const registryContract = await emblemRegistryContractFactory.attach(EMBLEM_REGISTRY_ADDRESS_MUMBAI);
        console.log("Attached to Registry contract at " + registryContract.address);

        let badgeStructs = [];
        let proofs = [];
        let positions = [];
        let i = parseInt(taskArgs.index);
        for (i; i < parseInt(taskArgs.index) + parseInt(taskArgs.size); i++) {
            proofs.push(tree.getHexProof(hashedLeaves[i]));
            positions.push(tree.getProof(hashedLeaves[i]).map(x => x.position === 'right' ? 1 : 0));

            const solidityBadge = {
                winner: leaves[i].earnedBadge.badgeWinner.id,
                badgeDefinitionNumber: leaves[i].earnedBadge.definition.badgeDefinitionNumber
            };
            badgeStructs.push(solidityBadge);

            if ((i+1) % 16 == 0 && i > 0) {
                console.log("unfurling batch: (" + (i-15) + ", " + i + ")");
                await registryContract.unfurlBatch(
                    badgeStructs.slice(i-15, i+1),
                    proofs.slice(i-15, i+1),
                    positions.slice(i-15, i+1),
                    tree.getHexRoot()
                );
            }
        }
    }
    else {
        console.log("minting not supported on " + hre.network.name + " network.");
    }
});


///////////// Block Explorer Verification Tasks /////////////

task("verifySubgraphController", "verifies SubgraphController contract on etherscan")
.setAction(async () => {
    const polygonFxRootAddresses = getPolygonFxRootAddresses();
    await hre.run("verify:verify", {
        address: getSubgraphControllerAddress(),
        constructorArguments: [
            polygonFxRootAddresses[0],
            polygonFxRootAddresses[1]
        ]
    });
});

task("verifyRegistry", "verifies Registry contract on polygonscan")
.setAction(async () => {
    await hre.run("verify:verify", {
        address: getRegistryAddress(),
        constructorArguments: [
            getPolygonFxChild()
        ]
    });
});


//////// ADDRESS HELPER FUNCTIONS //////////

function getSubgraphControllerAddress() {
    let address = "";
    if (hre.network.name == "goerli") {
        address = SoulboundAddresses.SubgraphController.goerli;
    } else {
        logNoAddressFound("SubgraphController");
    }
    return address;
}

function getRegistryAddress() {
    let address = "";
    if (hre.network.name == "mumbai") {
        address = SoulboundAddresses.Registry.mumbai;
    } else {
        logNoAddressFound("Registry");
    }
    return address;
}

function getLibraryAddress() {
    let address = "";
    if (hre.network.name == "mumbai") {
        address = SoulboundAddresses.SoulboundLibrary.mumbai;
    } else {
        logNoAddressFound("SoulboundLibrary");
    }
    return address;
}

function getPolygonFxChild() {
    let fxChild = "";
    if (hre.network.name == "mumbai") {
        fxChild = SoulboundAddresses.FxChild.mumbai
    } else if (hre.network.name == "matic") {
        fxChild = SoulboundAddresses.FxChild.matic
    } else {
        console.log("no checkpoint manager or fx child on " + hre.network.name + " network");
    }
    return fxChild;
}

function getPolygonFxRootAddresses() {
    let checkpointManager = "";
    let fxRoot = "";
    if (hre.network.name == "goerli") {
        checkpointManager = SoulboundAddresses.CheckpointManager.goerli;
        fxRoot = SoulboundAddresses.FxRoot.goerli;
    } else if (hre.network.name == "mainnet") {
        checkpointManager = SoulboundAddresses.checkpointManager.mainnet;
        fxRoot = SoulboundAddresses.FxRoot.mainnet;
    } else {
        console.log("no checkpoint manager or fx root on " + hre.network.name + " network");
    }
    return [checkpointManager, fxRoot];
}

function logNoAddressFound(contractName) {
    console.log("No address found for " + contractName + " on " + hre.network.name + " network.");
}
