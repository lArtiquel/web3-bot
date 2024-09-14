import { config } from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables
config();

// Environment variables
const INFURA_API_KEY = process.env.INFURA_API_KEY!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;
const START_BLOCK = Number(process.env.START_BLOCK);

// Setup provider and wallet
const provider = new ethers.providers.JsonRpcProvider(`https://sepolia.infura.io/v3/${INFURA_API_KEY}`);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const contractABI = [
  "event Ping(bytes32 hash)",
  "function pong(bytes32 hash) public"
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

async function listenToPingEvents() {
    console.log(`Starting to listen for Ping events from block ${START_BLOCK}...`);

    provider.on('block', async (blockNumber) => {
        try {
            // Compute the event signature hash
            const pingEventSignature = ethers.utils.id("Ping(bytes32)");

            const logs = await provider.getLogs({
                address: CONTRACT_ADDRESS,
                fromBlock: START_BLOCK,
                toBlock: blockNumber,
                topics: [pingEventSignature]
            });

            for (let log of logs) {
                const transactionHash = log.transactionHash;

                // Call pong function
                try {
                    const tx = await contract.pong(transactionHash);
                    console.log(`Pong sent for tx: ${transactionHash}, mined in block: ${tx.blockNumber}`);
                } catch (error) {
                    console.error(`Error sending pong for tx ${transactionHash}:`, error);
                }
            }
        } catch (error) {
            console.error(`Error fetching logs:`, error);
        }
    });
}

// Function to handle reconnection logic
function handleReconnection() {
    console.error('Reconnecting...');
    setTimeout(() => {
        listenToPingEvents().catch(console.error);
    }, 1000);
}

// Start listening to Ping events
listenToPingEvents().catch(handleReconnection);
