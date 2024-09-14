import Web3 from 'web3';
import { config } from 'dotenv';

// Load environment variables
config();

// Ensure the environment variable is available
const INFURA_URL_SEPOLIA = process.env.INFURA_URL_SEPOLIA;
if (!INFURA_URL_SEPOLIA) {
    throw new Error('INFURA_URL_SEPOLIA is not defined in the environment variables.');
}

// Initialize Web3 provider
const web3 = new Web3(new Web3.providers.HttpProvider(INFURA_URL_SEPOLIA));

async function getLatestBlock(): Promise<void> {
    try {
        const latestBlock = await web3.eth.getBlock('latest');
        console.log(`Latest Block Number: ${latestBlock.number}`);
        console.log(`Block Hash: ${latestBlock.hash}`);
        console.log(`Block Timestamp: ${new Date(Number(latestBlock.timestamp) * 1000).toISOString()}`);
    } catch (error) {
        console.error('Error fetching the latest block:', error);
    }
}

// Fetch and display the latest block
getLatestBlock();
