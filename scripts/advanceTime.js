const { ethers } = require("hardhat");
async function main() {
  await ethers.provider.send("evm_increaseTime", [60]);
  await ethers.provider.send("evm_mine");
  console.log("Time advanced by 60 seconds");
}
main();