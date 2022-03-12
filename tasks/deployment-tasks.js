const { 
  EMBLEM_REGISTRY_CONTRACT_NAME,
  EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME,
  EMBLEM_LIBRARY_NAME,
  getSubgraphControllerAddress,
  getRegistryAddress,
  getLibraryAddress,
  getPolygonFxChild,
  getPolygonFxRootAddresses,
 } = require("./address-helpers");
const { EmblemAddresses } = require('./addresses.json');


///////////// Deployment Tasks /////////////

task("deploySubgraphController", "Deploys SubgraphController contract with polygon bridge initialization")
.setAction(async() => {
    const polygonAddresses = getPolygonFxRootAddresses();

    await hre.run("deploySubgraphControllerWithFx",
    {
        checkpointManager: polygonAddresses[0],
        fxRoot: polygonAddresses[1]
    });
});

task("deployRegistry", "Deploys SubgraphController contract with polygon bridge initialization")
.setAction(async() => {
    const fxChild = getPolygonFxChild();
    await hre.run("deployRegistryWithFx",
    {
        fxChild: fxChild
    });
});

task("setTunnelMapping", "Points contracts from different networks at eachother")
.setAction(async () => {

    if (hre.network.name == "mumbai") {
        await hre.run("setRootTunnelMapping",
        {
            subgraphControllerAddress: EmblemAddresses.SubgraphController.goerli,
            registryContractAddress: getRegistryAddress(),
            libraryAddress: getLibraryAddress()
        });
    }
    else if (hre.network.name == "goerli") {
        await hre.run("setChildTunnelMapping", 
        { 
          subgraphControllerAddress: getSubgraphControllerAddress(),
          registryContractAddress: EmblemAddresses.Registry.mumbai
        });
    }
    else {
        console.log("task doesn't support network: " + hre.network.name);
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



////////// SUBTASKS //////////

subtask("deploySubgraphControllerWithFx", "Deploys SubgraphController contract")
.addParam("checkpointManager", "address of checkpoint manager for polygon bridge communication")
.addParam("fxRoot", "address of fxRoot used for polygon bridge communication")
.setAction(async (taskArgs) => {
  console.log(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
  console.log(taskArgs.checkpointManager);
    const subgraphControllerContractFactory = await ethers.getContractFactory(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
    // const deployTransaction = await subgraphControllerContractFactory.getDeployTransaction(taskArgs.checkpointManager, taskArgs.fxRoot);
    // console.log(subgraphControllerContractFactory);
    const subgraphControllerContract = await subgraphControllerContractFactory.deploy(taskArgs.checkpointManager, taskArgs.fxRoot);
    await subgraphControllerContract.deployed();
    console.log("SubgraphController contract deployed to: " + subgraphControllerContract.address);
});

subtask("deployRegistryWithFx", "Deploys Registry contract intended for layer 2")
.addParam("fxChild", "address of fxChild for polygon bridge communication")
.setAction(async (taskArgs) => {
    const emblemLibraryContractFactory = await ethers.getContractFactory(EMBLEM_LIBRARY_NAME);
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




