const { EmblemAddresses } = require('./addresses.json');


exports.EMBLEM_REGISTRY_CONTRACT_NAME = "EmblemRegistry";
exports.EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME = "EmblemSubgraphController";
exports.EMBLEM_LIBRARY_NAME = "EmblemLibrary";


exports.getSubgraphControllerAddress = () => {
  let address = "";
  if (hre.network.name == "goerli") {
      address = EmblemAddresses.SubgraphController.goerli;
  } else {
      logNoAddressFound("SubgraphController");
  }
  return address;
}

exports.getRegistryAddress = () => {
  let address = "";
  if (hre.network.name == "mumbai") {
      address = EmblemAddresses.Registry.mumbai;
  } else {
      logNoAddressFound("Registry");
  }
  return address;
}

exports.getLibraryAddress = () => {
  let address = "";
  if (hre.network.name == "mumbai") {
      address = EmblemAddresses.EmblemLibrary.mumbai;
  } else {
      logNoAddressFound("EmblemLibrary");
  }
  return address;
}

exports.getPolygonFxChild = () => {
  let fxChild = "";
  if (hre.network.name == "mumbai") {
      fxChild = EmblemAddresses.FxChild.mumbai
  } else if (hre.network.name == "matic") {
      fxChild = EmblemAddresses.FxChild.matic
  } else {
      console.log("no checkpoint manager or fx child on " + hre.network.name + " network");
  }
  return fxChild;
}

exports.getPolygonFxRootAddresses = () => {
  let checkpointManager = "";
  let fxRoot = "";
  if (hre.network.name == "goerli") {
      checkpointManager = EmblemAddresses.CheckpointManager.goerli;
      fxRoot = EmblemAddresses.FxRoot.goerli;
  } else if (hre.network.name == "mainnet") {
      checkpointManager = EmblemAddresses.checkpointManager.mainnet;
      fxRoot = EmblemAddresses.FxRoot.mainnet;
  } else {
      console.log("no checkpoint manager or fx root on " + hre.network.name + " network. Using goerlie contracts.");
      checkpointManager = EmblemAddresses.CheckpointManager.goerli;
      fxRoot = EmblemAddresses.FxRoot.goerli;
  }
  return [checkpointManager, fxRoot];
}

function logNoAddressFound(contractName) {
  console.log("No address found for " + contractName + " on " + hre.network.name + " network.");
}