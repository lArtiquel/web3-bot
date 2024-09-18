Kleros tasks (SRE/Back-end)

---

# Bot Syncing

## Task

There is a contract at `0xa7f42ff7433cb268dd7d59be62b00c30ded28d3d` (Sepolia) periodically emitting `Ping()` events. Write a bot (ideally in JavaScript or TypeScript) that calls its `pong()` function for every time a `Ping()` is emitted. Pass the hash of the transaction where the `Ping()` event was emitted to the `pong()` function. The bot should:
- Start at any block and send a `pong()` for each `Ping()` after this block (save this block number as it’s part of the deliverable).
- The program should send exactly one `pong()` for each `Ping()` made after the starting block. If you’ve made mistakes during the development, please deploy a new bot with a different address.
- The bot should be reliable and restart where it stopped in case of bugs, network outage, etc. without missing any `Ping()`.
- You will need Sepolia ETH for this exercise, there is a faucet at [Sepolia Faucet](https://sepoliafaucet.com/).
- Feel free to deploy the contract again if you wish and run this bot alongside yours. The source code of the contract is verified on Etherscan.

Run the bot so we can verify it works (your own machine if it stays up, AWS instance, etc.). Note that the bot must stay running until the exercise is corrected.

Deliverables:
- Source code of the bot.
- Address of the bot.
- The block number at which you started running it.

Tip:
Think about what types of failures can happen to the bot and defend against it. Examples:
- The bot gets rate-limited by the provider, or there is a temporary network failure, and how this can affect an event listener.
- A `pong()` the bot submitted never gets mined due to a spike in gas prices. In the case where there are multiple transactions pending mining and the bot gets restarted, can transactions with competing nonces cause a malfunction?

## What I Did

1. **Bot Implementation**: 
   - Developed a bot in **TypeScript** that listens for `Ping()` events emitted by the contract.
   - Each time a `Ping()` is detected, the bot extracts the **transaction hash** of the event and passes it to the `pong()` function.
   - The bot is designed to process each `Ping()` event exactly once, ensuring no duplicates.

2. **Event Monitoring**:
   - The bot starts listening for events from a specific block, defined by the `START_BLOCK` environment variable.
   - Event listeners were implemented to capture and handle `Ping()` events efficiently.

3. **Transaction Submission**:
   - For each detected event, the bot sends a `pong()` transaction to the contract, using the transaction hash of the `Ping()` event.

4. **Reliability**:
   - Implemented error-handling mechanisms to make the bot resilient to network issues, rate limits, and failures.
   - The bot saves its state (latest processed block) so that it can pick up from where it left off in case of restarts.

5. **Environment Variables**:
   - Configured the bot to use the following environment variables:
     - `INFURA_API_KEY`: API key for Infura.
     - `PRIVATE_KEY`: Private key for the bot’s Ethereum account.
     - `CONTRACT_ADDRESS`: Address of the contract being monitored.
     - `START_BLOCK`: Block number to start monitoring from.

6. **Deployment**:
   - The bot is designed to run continuously either on a local machine or a cloud instance (e.g., AWS) to ensure uninterrupted operation.
   - I tested the bot with Sepolia ETH for transaction fees and ensured that the contract interaction is functional.

7. **Resilience to Failures**:
   - Included strategies to handle provider rate-limiting and network outages.
   - The bot retries failed transactions in case of gas price spikes or pending transactions, avoiding issues related to competing nonces.

## Setup

1. **Clone the Repository**:
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2. **Install Dependencies**:
    ```bash
    npm install
    ```

3. **Create a `.env` File**:
    Create a `.env` file in the root directory of your project with the following content:
    ```plaintext
    INFURA_API_KEY=your_infura_api_key
    PRIVATE_KEY=your_private_key
    CONTRACT_ADDRESS=your_contract_address
    START_BLOCK=starting_block_number
    ```

4. **Run the Bot**:
    ```bash
    npm run startBot
    ```

## Bot State Management

The bot persists its state (including the latest processed block) in a `bot_state.json` file. This file allows the bot to resume processing from the last known state after a restart, ensuring no events are missed.

- **Initial Setup**: If the state file is absent or empty, the bot will start from the block number specified in the `START_BLOCK` environment variable.
- **Ongoing Operation**: The bot updates the state file after processing each `Ping()` event, ensuring that it resumes from the correct point after restarts.

### Example of `bot_state.json`

```json
{
  "latestProcessedBlock": 12345678
}
```

## Solutions Tracking Backlog

### 1. **Batching `eth_getLogs` Requests**

- **Problem**: Large block ranges caused `eth_getLogs` requests to time out.
- **Solution**: Introduced a batching mechanism to process logs in smaller batches (50 blocks at a time).

```typescript
const batchSize = 50; // Smaller block range for eth_getLogs requests
let fromBlock = botState.latestProcessedBlock + 1;

while (fromBlock <= blockNumber) {
    const toBlock = Math.min(fromBlock + batchSize - 1, blockNumber);
    const logs = await provider.getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: fromBlock,
        toBlock: toBlock,
        topics: [ethers.utils.id("Ping()")]
    });
    fromBlock = toBlock + 1;
}
```

### 2. **Nonce Management and Pending Transactions**

- **Problem**: Nonce mismanagement could cause conflicting transactions or skipped `pong()` calls.
- **Solution**: The bot dynamically fetches the current nonce with `wallet.getTransactionCount("pending")` before sending a transaction.

```typescript
const currentNonce = await wallet.getTransactionCount("pending");
const tx = await contract.pong(transactionHash, {
    nonce: currentNonce,
    gasPrice: await provider.getGasPrice()
});
```

### 3. **Persistent State and Block Tracking**

- **Problem**: The bot needed to resume from where it left off and track processed transactions persistently.
- **Solution**: The bot saves the latest processed block in a `bot_state.json` file and updates it after each successful transaction.

```typescript
botState.latestProcessedBlock = blockNumber; // Update the latest processed block
persistState();
```

### 4. **Improved Error Handling and Reconnection**

- **Problem**: The bot was reconnecting too quickly and possibly flooding requests when errors occurred.
- **Solution**: Implemented exponential backoff for reconnections with a delay that grows with each failed attempt.

```typescript
const delay = Math.min(1000 * 2 ** attempt, 30000); // Max delay of 30 seconds
setTimeout(async () => {
    handleReconnection(attempt + 1); // Increment attempt if it fails
}, delay);
```
