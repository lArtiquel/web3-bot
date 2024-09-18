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
    latestProcessedBlock: START_BLOCK
};

if (fs.existsSync(PERSISTENT_FILE)) {
    try {
        const stateData = fs.readFileSync(PERSISTENT_FILE, 'utf-8');
        if (stateData) {
            botState = JSON.parse(stateData);
        }
    } catch (error) {
        console.error('Error reading or parsing state file:', error);
        botState.latestProcessedBlock = START_BLOCK;  // Fallback to env variable
    }
}

// Function to persist bot state to file
function persistState() {
    fs.writeFileSync(PERSISTENT_FILE, JSON.stringify(botState));
}

// Function to retrieve missed Ping events from historical logs
async function retrieveHistoricalLogs() {

    const currentBlock = await provider.getBlockNumber();
    let fromBlock = botState.latestProcessedBlock + 1;
    const batchSize = 50; // Smaller block range for eth_getLogs requests

    while (fromBlock <= currentBlock) {
        const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);

        const logs = await provider.getLogs({
            address: CONTRACT_ADDRESS,
            fromBlock: fromBlock,
            toBlock: toBlock,
            topics: [ethers.utils.id("Ping()")]
        });

        for (const log of logs) {
            const transactionHash = log.transactionHash;

            console.log(`Historical Ping event detected for tx: ${transactionHash}`);
            await sendPong(transactionHash);
        }

        fromBlock = toBlock + 1; // Move to the next batch
    }

    // update current block in the persistent state
    botState.latestProcessedBlock = currentBlock;
    persistState();
}

// Listen to Ping events and send pong transactions
async function listenToPingEvents() {
    console.log(`Starting to listen for Ping events from block ${botState.latestProcessedBlock}...`);

    // Retrieve missed logs after reconnecting
    await retrieveHistoricalLogs();

    // Listen to new Ping events
    contract.on("Ping", async (event) => {
        const transactionHash = event.transactionHash;
        const blockNumber = event.blockNumber;  // Capture the block number from the event
    
        console.log(`New Ping event detected for tx: ${transactionHash}`);
        await sendPong(transactionHash);
    
        // Update the latest processed block to the block number of the event
        botState.latestProcessedBlock = blockNumber;
        persistState();
    });    

    // Log successful connection
    console.log('Successfully listening for Ping events.');

}

// Send pong transaction and handle nonce management
async function sendPong(transactionHash: string) {
    try {
        let currentNonce = await wallet.getTransactionCount("pending");
        console.log(`Current nonce: ${currentNonce}`);
        const tx = await contract.pong(transactionHash, {
            nonce: currentNonce, // Use dynamic nonce
            gasPrice: await provider.getGasPrice()
        });
        console.log(`Pong sent for tx: ${transactionHash}`);
        const txReceipt = await tx.wait();
        console.log(`Transaction mined in block ${txReceipt.blockNumber}`);
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
            // Remove old listeners to avoid duplicates before reconnecting
            contract.removeAllListeners();
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
