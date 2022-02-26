require("@nomiclabs/hardhat-ethers");
require("hardhat-gas-reporter");
require("hardhat-abi-exporter");


const fs = require('fs');
const { hrtime } = require("process");
const privateKey = fs.readFileSync(".secret").toString().trim();
const maticVigilKey = fs.readFileSync(".matic-vigil-key").toString().trim();


module.exports = {
  // defaultNetwork: "matic",
  networks: {
    hardhat: {
    },
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: [privateKey],
      gas: 5500000,
      gasPrice: 7000000000
    },
    matic: {
      url: "https://rpc-mainnet.maticvigil.com/v1/",// + maticVigilKey,
      accounts: [privateKey],
      gasPrice: 50000000000
    }
  },
  solidity: {
    version: "0.8.0",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 20000
  },
  gasReporter: {
    enabled: true
  },
  abiExporter: {
    path: './data/abi',
    runOnCompile: true,
    clear: true,
    flat: true,
    only: [],
    spacing: 2,
    pretty: true,
  }
}





const EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME = "EmblemSubgraphController";
const EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI = "0x97E804Bd6B8aA1fB5e701DD7Cb6648a14443058d";
const EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_MAINNET = "";
const EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_HH = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const GOERLI_CHECKPOINT_MANAGER = "0x2890bA17EfE978480615e330ecB65333b880928e";
const GOERLI_FX_ROOT = "0x3d1d3E34f7fB6D26245E6640E1c50710eFFf15bA";
const MAINNET_CHECKPOINT_MANAGER = "0x86e4dc95c7fbdbf52e33d563bbdb00823894c287";
const MAINNET_FX_ROOT = "0xfe5e5D361b2ad62c541bAb87C45a0B9B018389a2";

const EMBLEM_LIBRARY_CONTRACT_NAME = "EmblemLibrary";
const EMBLEM_LIBRARY_ADDRESS_MUMBAI = "0x4616fBE2920C5D15dC28334E30C3D574a4763562";
const EMBLEM_REGISTRY_CONTRACT_NAME = "EmblemRegistry";
const EMBLEM_REGISTRY_ADDRESS_HH = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const EMBLEM_REGISTRY_ADDRESS_MUMBAI = "0x8A5c7ec56C04a54A9e2E0583e5C91579391Cd31A";
const MUMBAI_FX_CHILD = "0xCf73231F28B7331BBe3124B907840A94851f9f11";
const POLYGON_FX_CHILD = "0x8397259c983751DAf40400790063935a11afa28a";

subtask("deploySubgraphController", "Deploys SubgraphController contract")
.addParam("checkpointManager", "address of checkpoint manager for polygon bridge communication")
.addParam("fxRoot", "address of fxRoot used for polygon bridge communication")
.setAction(async (taskArgs) => {
  const subgraphControllerContractFactory = await ethers.getContractFactory(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
  const subgraphControllerContract = await subgraphControllerContractFactory.deploy(taskArgs.checkpointManager, taskArgs.fxRoot);
  await subgraphControllerContract.deployed();
  console.log("SubgraphController contract deployed to: " + subgraphControllerContract.address);
});

subtask("deployRegistry", "Deploys Registry contract intended for layer 2")
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

subtask("setChildTunnelMapping", "Points SubgraphController at layer 2 Registry contract for bridged communication")
.addParam("subgraphControllerAddress", "address of Subgraph Controller contract")
.addParam("registryContractAddress", "address of Registry contract intended for layer 2")
.setAction(async (taskArgs) => {
  const subgraphControllerContractFactory = await ethers.getContractFactory(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
  const subgraphControllerContract = await subgraphControllerContractFactory.attach(taskArgs.subgraphControllerAddress);
  console.log("Attached to SubgraphControllerContract at " + subgraphControllerContract.address);

  await subgraphControllerContract.setFxChildTunnel(taskArgs.registryContractAddress);
  console.log("SubgraphController child set to " + subgraphControllerContract.fxChildTunnel());
});

subtask("printSubgraphController", "prints properties of SubgraphController")
.addParam("subgraphControllerAddress", "address of Subgraph Controller contract")
.setAction(async (taskArgs) => {
  const subgraphControllerContractFactory = await ethers.getContractFactory(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
  const subgraphControllerContract = await subgraphControllerContractFactory.attach(taskArgs.subgraphControllerAddress);
  console.log("Attached to SubgraphControllerContract at " + subgraphControllerContract.address);
  const fxRoot = await subgraphControllerContract.fxRoot();
  const checkpointManager = await subgraphControllerContract.checkpointManager();
  const fxChild = await subgraphControllerContract.fxChildTunnel();
  console.log("---SubgraphController---" + subgraphControllerContract.address + 
  "\n-fxRoot: " + fxRoot + "\n-checkpointManager: " + checkpointManager + "\n-fxChild: " + fxChild);
});

subtask("printRegistry", "prints properties of Registry")
.addParam("registryAddress", "address of Registry contract")
.addParam("libraryAddress", "address of library used by Registry contract")
.setAction(async (taskArgs) => {
  const emblemRegistryContractFactory = await ethers.getContractFactory(
    EMBLEM_REGISTRY_CONTRACT_NAME,
    {
      libraries: {
        EmblemLibrary: taskArgs.libraryAddress
      }
    }
  )

  const registryContract = await emblemRegistryContractFactory.attach(taskArgs.registryAddress);
  console.log("Attached to Registry contract at " + registryContract.address);

  const fxChild = await registryContract.fxChild();
  const fxRootTunnel = await registryContract.fxRootTunnel();
  const latestStateId = await registryContract.latestStateId();
  console.log("---Registry---" + registryContract.address + "\n-fxChild: " + 
  fxChild + "\n-fxRootTunnel: " + fxRootTunnel + 
  "\n-latestStateId: " + latestStateId);
});

subtask("setRootTunnelMapping", "Points SubgraphController and Registry contracts at one another for bridged communication")
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
  )

  const registryContract = await emblemRegistryContractFactory.attach(taskArgs.registryContractAddress);
  console.log("Attached to Registry contract at " + registryContract.address);

  await registryContract.setFxRootTunnel(taskArgs.subgraphControllerAddress);
  console.log("Registry fxRoot set to " + registryContract.fxRootTunnel());
});




task("deploySubgraphControllerGoerli", "Deploys SubgraphController contract with Goerli-Mumbai polygon bridge initialization")
.setAction(async() => {
  await hre.run("deploySubgraphController",
  {
    checkpointManager: GOERLI_CHECKPOINT_MANAGER,
    fxRoot: GOERLI_FX_ROOT
  });
});

task("deployRegistryMumbai", "Deploys SubgraphController contract with Mumbai->Goerli polygon bridge initialization")
.setAction(async() => {
  await hre.run("deployRegistry",
  {
    fxChild: MUMBAI_FX_CHILD
  });
});


task("setChildTunnelMappingGoerli", "Points SubgraphController at layer 2 Registry contract for bridged communication")
.setAction(async () => {
  await hre.run("setChildTunnelMapping", 
  { 
    subgraphControllerAddress: EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI,
    registryContractAddress: EMBLEM_REGISTRY_ADDRESS_MUMBAI
  });
});

task("setRootTunnelMappingMumbai", "Points Registry at layer 1 SubgraphController contract for bridged communication")
.setAction(async () => {
  await hre.run("setRootTunnelMapping",
  {
    subgraphControllerAddress: EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI,
    registryContractAddress: EMBLEM_REGISTRY_ADDRESS_MUMBAI,
    libraryAddress: EMBLEM_LIBRARY_ADDRESS_MUMBAI
  });
});


subtask("sendMessageToMumbaiContract", "Attaches to SubgraphController and sends a message to it's layer 2 child")
.addParam("subgraphControllerAddress", "address of SubgraphController contract already configured for bridge")
.setAction(async (taskArgs) => {
  const subgraphControllerContractFactory = await ethers.getContractFactory(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
  const subgraphControllerContract = await subgraphControllerContractFactory.attach(taskArgs.subgraphControllerAddress);
  console.log("Attached to SubgraphControllerContract at " + subgraphControllerContract.address);

  const message = "0x8397259c983751DAf40400790063935a11afa28a";
  await subgraphControllerContract.sendMessageToChild(message);
  console.log("Message sent: " + message);
});

task("sendMessageGoerliToMumbai", "Sends a message from SubgraphController to Registry using the Goerli<->Mumbai polygon bridge")
.setAction(async () => {
  await hre.run("sendMessageToMumbaiContract",
  {
    subgraphControllerAddress: EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI
  });
});

task("printSubgraphControllerGoerli", "prints SubgraphController contract properties")
.setAction(async () => {
  await hre.run("printSubgraphController",
  {
    subgraphControllerAddress: EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI
  });
});

task("printRegistryMumbai", "prints Registry contract properties")
.setAction(async () => {
  await hre.run("printRegistry",
  {
    registryAddress: EMBLEM_REGISTRY_ADDRESS_MUMBAI,
    libraryAddress: EMBLEM_LIBRARY_ADDRESS_MUMBAI
  })
})
