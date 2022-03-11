# Emblem Contracts

### Emblem utilizes logic from a subgraph (a tool for indexing blockchains) in order to issue non-transferable on chain reputation. The [Emblem subgraph](https://thegraph.com/explorer/subgraph?id=BKWqzRUajb4zK3X8LwwEACH2tVgprgEE8ZdsHdknxQEk&view=Overview) awards badges and verifies oracle data posted to the EmblemDAO's Polygon Bridge contract on mainnet for maximum transparency. The oracle data represents batches of "blockchain achievements," or "badges" that have been earned by Ethereum accounts. This data is unwraveled in a Registry contract on Matic network. Trackable metrics are predefined by the subgraph, and a SubgraphController contract defines badgeworthy behavior by emitting events with metrics and thresholds.

![Emblem Architecture - Subgraph Bridge Smart Contract Interface](https://user-images.githubusercontent.com/4196637/157934435-81973e96-838d-4eb8-9bcd-1a9a03948e5a.jpeg)

## Requirements
1. Store a throwaway private key and API keys in a secrets.json file in the root directory. A private key is required for ethers to interact with live networks. All other API keys are optional if the corresponding code is removed from hardhat.config.js. The Hardhat config expects the following in secrets.json:
   - privateKey (don't use anything with real funds attached)
   - maticVigilKey
   - etherscanKey
   - polygonscanKey
   - alchemyGoerliKey
   - infuraKey
  
2. run ```npm install``` from the root directory
3. run ```npx hardhat compile``` to compile smart contracts

## Hardhat task flow
1. ```npx hardhat deploySubgraphController --network goerli```
   - paste the contract address in tasks/addresses.json -> SubgraphController
2. ```npx hardhat deployRegistry --network mumbai```
   - paste the library contract address in tasks/addresses.json -> EmblemLibrary
   - paste the registry contract address in tasks.js -> EmblemRegistry
3. ```npx hardhat setTunnelMapping --network goerli```
   - points the SubgraphController contract at the layer 2 Registry contract
4. ```npx hardhat setTunnelMapping --network mumbai```
   - points the Registry contract at layer 1 SubgraphController contract

## To verify the contracts on block explorers, run the following hardhat tasks:
```npx hardhat verifySubgraphController --network goerli```

```npx hardhat verifyRegistry --network mumbai```

## The contracts are now ready for bridged communication from Goerli to Mumbai.
1. ```npx hardhat postMerkleRootFromSubgraph --index 0 --size 256 --network goerli``` queries a subgraph for badge awards with ids 0-256, hashes them into a merkle root, and posts it to the SubgraphController so it can be sent to layer 2 while still exploiting subgraph capabilities for full reputational transparency. The root won't be available in the layer 2 Registry contract until the next state sync. Index and size parameters are required so the subgraph can validate merkle roots.
2. ```npx hardhat unfurlMerkleRoot --index 0 --size 256 --network mumbai``` queries a subgraph for badge awards with ids 0-256, constructs a merkle tree, and iterates over each leaf. Badge proofs are then sent via the unfurlBatch function and minted in batches of 16 at a time. The Registry contract also verifies that it has received the merkle root from EmblemDAO's Polygon Bridge contract.
