# X-Native Token Deployment Bot (Four.Meme Edition)

A Twitter-native bot that allows users to deploy meme tokens on **Four.Meme** (BSC/BNB Chain) directly via DM interactions. The bot manages secure custodial wallets for users, allowing them to fund and deploy tokens without ever leaving the X (Twitter) app.

## Features

- **Custodial Wallets**: Automatically generates a unique, encrypted wallet for every user upon interaction.
- **Four.Meme Integration**: Deploys tokens directly to the Four.Meme pump.fun-style bonding curve platform.
- **DM-Based Workflow**:
  - `start`: Generates a wallet and provides the address for funding.
  - `deploy`: Deploys a token using the funded wallet.
- **TwitterAPI.io Integration**: Bypasses expensive official API limitations for reading DMs/mentions and posting replies.

## How It Works

1. **User Initiation**: User DMs `start` to the bot.
2. **Wallet Generation**: Bot creates a generic ETH/BSC wallet, encrypts the private key with `AES-256`, and saves it to the database linked to the user's Twitter ID.
3. **Funding**: User sends BNB (~0.02 BNB) to their generated wallet address to cover deployment fees.
4. **Deployment**: User DMs `deploy` with token details.
5. **Execution**:
   - Bot decrypts the user's private key in memory.
   - Bot authenticates with Four.Meme API.
   - Bot signs the deployment transaction using the *user's* wallet.
   - Token is created on-chain.
   - Bot replies with the CA and success message.

## Usage Commands

### 1. Start / Generate Wallet
**DM:**
```text
start
```
**Bot Reply:**
> ✅ Wallet Generated!
> Address: 0x123...
> Please deposit ~0.02 BNB to cover deployment fees.

### 2. Deploy Token
**DM:**
```text
deploy
name: My Awesome Token
symbol: MAT
image: https://path.to/image.png
desc: Optional description
twitter: https://x.com/... (Optional)
telegram: https://t.me/... (Optional)
website: https://mytoken.com (Optional)
```
**Bot Reply:**
> ✅ Deployment Successful!
> Token: 0xABC...
> View on BscScan: ...

## Technical Stack

- **Backend**: Node.js, TypeScript
- **Database**: PostgreSQL (User data & Encrypted Keys)
- **Queue**: Redis + BullMQ (Rate limiting & concurrency)
- **Blockchain**: ethers.js, viem
- **APIs**:
  - **Four.Meme**: For getting deployment signatures.
  - **TwitterAPI.io**: For X interactions.

## Setup & Installation

### 1. Environment Variables
Copy `.env.example` to `.env` and fill in:
- `BOT_PRIVATE_KEY`: Master wallet for the bot instance.
- `ENCRYPTION_KEY`: 32-byte hex string for encrypting user keys.
- `TWITTERAPI_IO_KEY`: Credentials for X interaction.
- `DATABASE_URL` / `REDIS_URL`: Infrastructure connections.

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Run Database Migrations
```bash
npm run db:push  # or use the schema.sql manually
```

### 4. Start the Bot
```bash
npm run dev
```

## Security

- **Encryption**: User private keys are stored **encrypted** at rest (AES-256-CBC). They are only decrypted momentarily in system memory to sign transactions.
- **Custodial Risk**: As with any custodial bot, the server operator technically has access to the database. Users should only deposit enough BNB for deployment (e.g., ~$10-20).
