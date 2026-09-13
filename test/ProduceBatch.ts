import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("ProduceBatch", async function () {

  it("Should create a produce batch", async function () {

    const { viem } = await network.connect();

    const contract = await viem.deployContract("ProduceBatch");

    const [farmer] = await viem.getWalletClients();

    await contract.write.createBatch([
      "Tomatoes",
      500n,
      "QmFakeHashForNow"
    ]);

    const batch = await contract.read.batches([1n]);

    assert.equal(batch[0], 1n);
    assert.equal(batch[1], "Tomatoes");
    assert.equal(batch[2], 500n);
    assert.equal(batch[3].toLowerCase(), farmer.account.address.toLowerCase());
    assert.equal(batch[4], "QmFakeHashForNow");
    assert.equal(batch[6], "Harvested");
  });


  it("Should update the batch status and store history", async function () {

    const { viem } = await network.connect();

    const contract = await viem.deployContract("ProduceBatch");

    await contract.write.createBatch([
      "Tomatoes",
      500n,
      "QmFakeHashForNow"
    ]);

    await contract.write.updateStatus([
      1n,
      "In Transit"
    ]);

    const batch = await contract.read.batches([1n]);

    assert.equal(batch[1], "Tomatoes");
    assert.equal(batch[2], 500n);
    assert.equal(batch[6], "In Transit");

    const history = await contract.read.getHistory([1n]);

    assert.equal(history.length, 2);

    assert.equal(history[0].status, "Harvested");
    assert.equal(history[1].status, "In Transit");
  });

});