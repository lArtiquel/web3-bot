require('dotenv').config();
const Web3 = require('web3');
const ethers = require('ethers');

// Environment variables
const INFURA_API_KEY = process.env.INFURA_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const START_BLOCK = process.env.START_BLOCK;

// Setup Web3 provider and contract
const provider = new ethers.providers.InfuraProvider('sepolia', INFURA_API_KEY);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const contractABI = [
  "event Ping()",
  "function pong(bytes32 hash) public"
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

async function listenToPingEvents() {
    console.log(`Starting to listen for Ping events from block ${START_BLOCK}...`);
    const startingBlock = Number(START_BLOCK);

    provider.on('block', async (blockNumber) => {
        try {
            const logs = await provider.getLogs({
                address: CONTRACT_ADDRESS,
                fromBlock: startingBlock,
                toBlock: 'latest',
                topics: [ethers.utils.id("Ping()")]
            });

            for (let log of logs) {
                const transactionHash = log.transactionHash;

                // Call pong function
                try {
                    const tx = await contract.pong(transactionHash);
                    console.log(`Pong sent for tx: ${transactionHash}, mined in block: ${tx.blockNumber}`);
                } catch (error) {
                    console.error(`Error sending pong for tx ${transactionHash}:`, error);
                    // Handle errors (e.g., retry logic, logging)
                }
            }
        } catch (error) {
            console.error(`Error fetching logs:`, error);
            // Handle provider errors, potentially retrying
        }
    });

    provider._websocket.on('close', () => {
        console.error('WebSocket closed, reconnecting...');
        setTimeout(listenToPingEvents, 1000); // Reconnect with a delay
    });

    provider._websocket.on('error', (error) => {
        console.error('WebSocket error:', error);
        setTimeout(listenToPingEvents, 1000); // Reconnect on error
    });
}

// Start listening to Ping events
listenToPingEvents();
