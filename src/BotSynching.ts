import { config } from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

// Load environment variables
config();

// Environment variables
const INFURA_API_KEY = process.env.INFURA_API_KEY!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;
const START_BLOCK = Number(process.env.START_BLOCK);

// Persistent storage for nonce and latest processed block
const PERSISTENT_FILE = 'bot_state.json';

// Setup provider and wallet
const provider = new ethers.providers.JsonRpcProvider(`https://sepolia.infura.io/v3/${INFURA_API_KEY}`);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const contractABI = [
  "event Ping()",
  "function pong(bytes32 _txHash) public"
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

// Load or initialize bot state (nonce and last processed block)
let botState = {
    latestProcessedBlock: START_BLOCK,
    nonce: 0
};

if (fs.existsSync(PERSISTENT_FILE)) {
    botState = JSON.parse(fs.readFileSync(PERSISTENT_FILE, 'utf-8'));
}

// Function to persist bot state to file
function persistState() {
    fs.writeFileSync(PERSISTENT_FILE, JSON.stringify(botState));
}

// Flag to prevent multiple listeners
let listening = false;

// Listen to Ping events and send pong transactions
async function listenToPingEvents() {
    if (listening) return; // Prevent multiple listeners
    listening = true;

    console.log(`Starting to listen for Ping events from block ${botState.latestProcessedBlock}...`);

    provider.on('block', async (blockNumber) => {
        try {
            if (blockNumber > botState.latestProcessedBlock) {
                const logs = await provider.getLogs({
                    address: CONTRACT_ADDRESS,
                    fromBlock: botState.latestProcessedBlock + 1,
                    toBlock: blockNumber,
                    topics: [ethers.utils.id("Ping()")]
                });

                for (let log of logs) {
                    const transactionHash = log.transactionHash;

                    // Send pong transaction
                    await sendPong(transactionHash);
                }

                // Update latest processed block
                botState.latestProcessedBlock = blockNumber;
                persistState();
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
            listening = false; // Allow reconnection
            provider.removeAllListeners('block'); // Clear listeners to avoid stacking
            handleReconnection(); // Retry on error
        }
    });
}

// Send pong transaction and handle nonce management
async function sendPong(transactionHash: string) {
    try {
        const currentNonce = await wallet.getTransactionCount("pending");
        const tx = await contract.pong(transactionHash, {
            nonce: currentNonce, // Use dynamic nonce
            gasPrice: await provider.getGasPrice()
        });
        console.log(`Pong sent for tx: ${transactionHash}`);
        await tx.wait();
        console.log(`Transaction mined in block ${tx.blockNumber}`);

        // Increment nonce and persist state
        botState.nonce++;
        persistState();
    } catch (error) {
        console.error(`Error sending pong for tx ${transactionHash}:`, error);
        handleReconnection(); // Retry on failure
    }
}

// Handle reconnection logic with exponential backoff
function handleReconnection(attempt = 1) {
    const delay = Math.min(1000 * 2 ** attempt, 30000); // Exponential backoff with a max delay of 30 seconds
    setTimeout(async () => {
        console.log(`Reconnecting, attempt ${attempt}`);
        try {
            await listenToPingEvents(); // Re-establish listener
            console.log('Reconnected successfully');
        } catch (error) {
            console.error('Reconnection failed, retrying:', error);
            handleReconnection(attempt + 1); // Increment attempt if it fails
        }
    }, delay);
}

// Start listening to Ping events
listenToPingEvents().catch((error) => {
    console.error('Error starting event listener:', error);
    handleReconnection(); // Retry if the initial connection fails
});
