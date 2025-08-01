require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const path = require("path");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    "@openzeppelin": path.join(__dirname, "node_modules/@openzeppelin")
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.INFURA_MAINNET_RPC_URL,
        blockNumber: 19000000, // Optional: pin to a block
      },
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
