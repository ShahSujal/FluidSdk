# FluidSDK

**X402 Agent Gateway + Payment Streamline SDK for Web3 Developers**

FluidSDK is a comprehensive TypeScript/JavaScript SDK that enables Web3 developers to build, register, and manage AI agents with seamless payment integration through the X402 protocol. It provides a complete solution for agent identity management, reputation tracking, MCP (Model Context Protocol) integration, and decentralized feedback systems.

## 🚀 Features

- **🤖 Agent Registry**: Register and manage AI agents on-chain with ERC-8004 compliance
- **💳 X402 Payment Integration**: Built-in support for HTTP 402 payment flows
- **🔗 MCP Protocol Support**: Native integration with Model Context Protocol servers
- **📊 Reputation System**: On-chain feedback and reputation tracking
- **🌐 Multi-Chain**: Support for Ethereum Sepolia, Base Sepolia, Linea Sepolia, and Polygon Amoy
- **📦 IPFS Storage**: Decentralized metadata storage via Pinata
- **🔍 Subgraph Queries**: Fast agent discovery and filtering via The Graph
- **⛓️ EVM Compatible**: Works with any EVM-compatible blockchain

## 📦 Installation

```bash
npm install fluidsdk ethers dotenv
```

## 🔧 Quick Start

### 1. Setup Environment Variables

Create a `.env` file:

```env
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_private_key_here
CHAIN_ID=11155111
PINATA_JWT=your_pinata_jwt_token
```

### 2. Initialize the SDK

```typescript
import { FluidSDK } from "fluidsdk";
import { ethers } from "ethers";

// Create a signer
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!);

// Initialize SDK
const sdk = new FluidSDK({
  chainId: 11155111, // Sepolia
  rpcUrl: process.env.RPC_URL!,
  signer: signer,
  ipfs: "pinata",
  pinataJwt: process.env.PINATA_JWT,
});

// Wait for initialization
await sdk.chainId();
console.log("✅ SDK initialized");
```

## 📚 Usage Examples

### Register an AI Agent

```typescript
// Create agent configuration
const agent = sdk.createAgent({
  name: "My AI Assistant",
  description: "A helpful AI agent for crypto tasks",
  image: "https://example.com/agent-image.png",
  x402support: true, // Enable X402 payment protocol
  metadata: { 
    category: "DeFi",
    version: "1.0.0" 
  },
  active: true,
  owners: [signer.address as `0x${string}`],
});

// Register on-chain with IPFS metadata
const registration = await agent.registerIPFS();
console.log("Agent ID:", registration.agentId);
console.log("IPFS URI:", registration.agentURI);
```

### Add MCP Server Integration

```typescript
// Configure MCP endpoint (Model Context Protocol)
await agent.setMCP(
  "https://your-mcp-server.com/mcp",
  "2024-11-05", // Protocol version
  true // Auto-fetch capabilities
);

// Register agent with MCP capabilities
const registration = await agent.registerIPFS();
```

### Query Agents from Subgraph

```typescript
// Get specific agent
const agent = await sdk.getAgent("11155111:1650");
console.log("Agent Name:", agent.name);
console.log("MCP Tools:", agent.mcpTools);

// Search agents with filters
const results = await sdk.searchAgents({
  active: true,
  x402support: true,
}, undefined, 10);

console.log(`Found ${results.items.length} agents`);
results.items.forEach(agent => {
  console.log(`- ${agent.name} (${agent.agentId})`);
});
```

### Give Feedback to an Agent

```typescript
// Prepare feedback
const feedbackFile = sdk.prepareFeedback(
  "11155111:1650", // Agent ID
  5, // Score (1-5)
  ["helpful", "accurate", "fast"], // Tags
  "Great agent, very responsive!", // Text review
  "natural-language", // Capability
  "My AI Assistant", // Agent name
  "question-answering", // Skill
  "crypto-query", // Task
  { sessionId: "abc123" }, // Context
  undefined, // Proof of payment
  { automated: false } // Extra metadata
);

// Submit feedback on-chain
const feedback = await sdk.giveFeedback(
  "11155111:1650",
  feedbackFile
);

console.log("Feedback submitted:", feedback.id);
```

### Get Agent Reputation

```typescript
// Get reputation summary
const reputation = await sdk.getReputationSummary("11155111:1650");

console.log("Total Feedback:", reputation.count);
console.log("Average Score:", reputation.averageScore);

// Search feedback for an agent
const feedbacks = await sdk.searchFeedback(
  "11155111:1650",
  ["helpful"], // Filter by tags
  undefined, // Capabilities
  undefined, // Skills
  4 // Min score
);

feedbacks.forEach(fb => {
  console.log(`Score: ${fb.score}, Reviewer: ${fb.reviewer}`);
});
```

### Update Agent Metadata

```typescript
// Update name and description
await agent.updateInfo("New Agent Name", "Updated description");

// Set custom metadata
await agent.setMetadata("apiEndpoint", "https://api.example.com");
await agent.setMetadata("version", "2.0.0");
```

## 🏗️ Complete Example

See the full example in [`scripts/script.ts`](./scripts/script.ts) which demonstrates:

1. ✅ SDK initialization with IPFS
2. ✅ MCP server connectivity testing
3. ✅ Agent creation with MCP integration
4. ✅ On-chain registration with IPFS metadata
5. ✅ Subgraph querying and verification
6. ✅ Feedback submission and retrieval
7. ✅ Reputation tracking

Run the example:

```bash
npm run script
```

## 🔑 X402 Protocol: Payment-Gated AI Agents

FluidSDK includes built-in support for the **X402 protocol**, enabling monetization of AI agent services:

### What is X402?

X402 is an extension of HTTP 402 (Payment Required) adapted for blockchain-based payments. It enables:

- **Pay-per-use AI services**: Charge users for agent interactions
- **Micropayments**: Support for small transactions on Layer 2 networks
- **Automatic billing**: Smart contract-based payment flows
- **Proof of payment**: On-chain verification of service access

### Enable X402 for Your Agent

```typescript
const agent = sdk.createAgent({
  name: "Premium AI Agent",
  description: "High-quality AI service with X402 payments",
  x402support: true, // Enable payment gateway
  metadata: {
    pricing: {
      perQuery: "0.001", // ETH per query
      perMinute: "0.01", // ETH per minute
    }
  },
  active: true,
  owners: [signer.address as `0x${string}`],
});
```

### Payment Flow

1. User requests agent service
2. Agent responds with HTTP 402 + payment details
3. User submits payment on-chain
4. Agent verifies payment
5. Agent provides service
6. Payment proof stored in feedback

```typescript
// Include payment proof in feedback
const feedbackFile = sdk.prepareFeedback(
  agentId,
  5,
  ["paid", "quality"],
  "Worth the payment!",
  "premium-query",
  agentName,
  "advanced-analysis",
  "market-prediction",
  { paymentAmount: "0.001" },
  "0x..." // Payment transaction hash
);
```

## 🌐 Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Ethereum Sepolia | 11155111 | ✅ Active |
| Base Sepolia | 84532 | ✅ Active |
| Linea Sepolia | 59141 | ✅ Active |
| Polygon Amoy | 80002 | ✅ Active |

## 📖 API Reference

### FluidSDK Class

#### Constructor Options

```typescript
{
  chainId: number;           // Blockchain network ID
  rpcUrl: string;            // RPC endpoint URL
  signer?: ethers.Wallet;    // Wallet for transactions
  ipfs?: "pinata";           // IPFS provider
  pinataJwt?: string;        // Pinata API token
}
```

#### Main Methods

- `createAgent(config)` - Create a new agent instance
- `getAgent(agentId)` - Fetch agent by ID
- `searchAgents(filters, cursor, limit)` - Search with filters
- `loadAgent(agentId)` - Load agent for modifications
- `prepareFeedback(...)` - Prepare feedback for submission
- `giveFeedback(agentId, feedback)` - Submit feedback on-chain
- `getReputationSummary(agentId)` - Get agent reputation
- `searchFeedback(agentId, ...)` - Query feedback with filters

### Agent Class

#### Methods

- `setMCP(endpoint, version, autoFetch)` - Configure MCP server
- `setA2A(endpoint, version, autoFetch)` - Configure A2A integration
- `registerIPFS()` - Register agent on-chain with IPFS
- `updateInfo(name, description, image)` - Update basic info
- `setMetadata(key, value)` - Set custom metadata
- `addOperators(addresses)` - Add operator addresses
- `removeOperators(addresses)` - Remove operators

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run example script
npm run script

# Run with TypeScript directly
npm run dev scripts/script.ts
```

## 📄 Contract Addresses

### Sepolia (11155111)
- **Identity Registry**: `0x8004a6090Cd10A7288092483047B097295Fb8847`
- **Reputation Registry**: `0x8004B8FD1A363aa02fDC07635C0c5F94f6Af5B7E`

### Base Sepolia (84532)
- **Identity Registry**: `0x8004AA63c570c570eBF15376c0dB199918BFe9Fb`
- **Reputation Registry**: `0x8004bd8daB57f14Ed299135749a5CB5c42d341BF`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

ISC License

## 🔗 Links

- [NPM Package](https://www.npmjs.com/package/fluidsdk)
- [GitHub Repository](https://github.com/ShahSujal/FluidSdk)
- [Documentation](https://github.com/ShahSujal/FluidSdk/tree/main/docs)
- [Example Scripts](./scripts)

## 💡 Use Cases

### For Web3 Developers
- Build AI-powered dApps with payment integration
- Create autonomous agents with on-chain identity
- Implement reputation systems for AI services
- Monetize AI models through X402 protocol

### For AI Developers
- Register AI models on-chain
- Enable pay-per-use pricing
- Track usage and reputation
- Integrate with MCP protocol servers

### For DeFi Projects
- AI-powered trading bots with payment flows
- Smart contract analysis agents
- Automated market analysis services
- Risk assessment AI with reputation tracking

---

**Built for Web3 developers who want to seamlessly integrate AI agents with blockchain payments and identity management.**
