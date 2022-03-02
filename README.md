# Soulbound Contracts

### Soulbound utilizes logic from a subgraph (a tool for indexing blockchains) in order to issue non-transferable on chain reputation. The [Soulbound subgraph](https://thegraph.com/explorer/subgraph?id=BKWqzRUajb4zK3X8LwwEACH2tVgprgEE8ZdsHdknxQEk&view=Overview) awards badges and verifies oracle data posted to the SoulboundDAO's Polygon Bridge contract on mainnet for maximum transparency. The oracle data represents batches of "blockchain achievements," or "badges" that have been earned by Ethereum accounts. This data is unwraveled in a Registry contract on Matic network. Trackable metrics are predefined by the subgraph, and a SubgraphController contract defines badgeworthy behavior by emitting events with metrics and thresholds.

<img width="1301" alt="Screen Shot 2022-03-02 at 11 43 26 AM" src="https://user-images.githubusercontent.com/4196637/156437729-48390b40-d5d8-468c-a69c-71d4610626b0.png">

## Requirements
1. Store a throwaway private key and API keys in a secrets.json file in the root directory. A private key is required for ethers to interact with live networks. All other API keys are optional if the corresponding code is removed from hardhat.config.js. The Hardhat config expects for the following in secrets.json:
   - privateKey (don't use anything with real funds attached)
   - maticVigilKey
   - etherscanKey
   - polygonscanKey
   - alchemyGoerliKey
  
2. run ```npm install``` from the root directory
3. run ```npx hardhat compile``` to compile smart contracts

## Hardhat task flow
1. ```npx hardhat deploySubgraphController --network goerli```
   - paste the contract address in tasks.js -> EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI
2. ```npx hardhat deployRegistry --network mumbai```
   - paste the library contract address in tasks.js -> EMBLEM_LIBRARY_ADDRESS_MUMBAI
   - paste the registry contract address in tasks.js -> EMBLEM_REGISTRY_ADDRESS_MUMBAI
3. ```npx hardhat setTunnelMapping --network goerli```
   - points the SubgraphController contract at the layer 2 Registry contract
4. ```npx hardhat setTunnelMapping --network mumbai```
   - points the Registry contract at layer 1 SubgraphController contract

## The contracts are now ready for bridged communication from Goerli to Mumbai.
1. ```npx hardhat postMerkleRootFromSubgraph --index 0 --size 256 --network goerli``` queries a subgraph for badge awards with ids 0-256, hashes them into a merkle root, and posts it to the SubgraphController so it can be sent to layer 2 while still exploiting subgraph capabilities for full reputational transparency. The root won't be available in the layer 2 Registry contract until the next state sync. Index and size parameters are required so the subgraph can validate merkle roots.
2. ```npx hardhat unfurlMerkleRoot --root {32 bytes} --index 0 --size 256 --network mumbai``` queries a subgraph for badge awards with ids 0-256, constructs a merkle tree, and iterates over each leaf. Every iteration calls the Reigstry contract's ```mint``` function with the required data to prove the badge is legitimate. The Registry contract also verifies that it has received the merkle root from the SubgraphController contract.
