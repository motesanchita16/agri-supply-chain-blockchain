// IMPORTANT: replace this with the address printed by your latest
// `npx hardhat run scripts/deploy.js --network sepolia` run.
// Every time you change the .sol file and redeploy, this address changes.
export const CONTRACT_ADDRESS =
  "0x8a3c85004aabdef65780950f7e64b99eab48f3dc";

export const SEPOLIA_CHAIN_ID = 11155111n;

export const CONTRACT_ABI = [
  "function batchCount() view returns (uint256)",

  "function batches(uint256) view returns (uint256 id, string produceType, uint256 quantityKg, address farmer, string ipfsHash, uint256 timestamp, string status, bool delivered)",

  "function trustScore(address) view returns (uint256)",

  "function createBatch(string _produceType, uint256 _quantityKg, string _ipfsHash)",

  "function updateStatus(uint256 _batchId, string _newStatus)",

  "function confirmDelivery(uint256 _batchId)",

  "function getHistory(uint256 _batchId) view returns (tuple(string status, address updatedBy, uint256 timestamp)[])",

  "function getTrustScore(address _user) view returns (uint256)",

  "event BatchCreated(uint256 id, address farmer, string produceType)",

  "event StatusUpdated(uint256 id, string status, address updatedBy)",

  "event DeliveryConfirmed(uint256 id, address farmer, uint256 newTrustScore)",
];
