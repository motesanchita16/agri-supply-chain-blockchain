import { network } from "hardhat";

const { viem } = await network.connect();

const produceBatch = await viem.deployContract("ProduceBatch");

console.log("ProduceBatch deployed to:", produceBatch.address);