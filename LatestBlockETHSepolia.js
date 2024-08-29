const Web3 = require('web3');
require('dotenv').config();

console.log(process.env.INFURA_URL_SEPOLIA)
const web3 = new Web3((new Web3.providers.HttpProvider(process.env.INFURA_URL_SEPOLIA)));

async function getLatestBlock() {
    try {
        const latestBlock = await web3.eth.getBlock('latest');
        console.log(`Latest Block Number: ${latestBlock.number}`);
        console.log(`Block Hash: ${latestBlock.hash}`);
        console.log(`Block Timestamp: ${new Date(latestBlock.timestamp * 1000)}`);
    } catch (error) {
        console.error("Error fetching the latest block:", error);
    }
}

getLatestBlock();
