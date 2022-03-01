require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-gas-reporter");
require("hardhat-abi-exporter");
require("./tasks.js");

const { 
  privateKey, 
  maticVigilKey, 
  etherscanKey, 
  polygonscanKey, 
  alchemyGoerliKey 
} = require('./secrets.json');


module.exports = {
  networks: {
    hardhat: {
    },
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com/v1/" + maticVigilKey,
      accounts: [privateKey],
      gas: 5500000,
      gasPrice: 7000000000
    },
    matic: {
      url: "https://rpc-mainnet.maticvigil.com/v1/" + maticVigilKey,
      accounts: [privateKey],
      gasPrice: 50000000000
    },
    goerli: {
      url: "https://eth-goerli.alchemyapi.io/v2/" + alchemyGoerliKey,
      accounts: [privateKey]
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
  },
  etherscan: {
    apiKey: {
      mainnet: etherscanKey,
      goerli: etherscanKey,
      polygon: polygonscanKey,
      polygonMumbai: polygonscanKey
    }
  }
}
