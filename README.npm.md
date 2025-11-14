# FluidSDK

**X402 Agent Gateway + Payment Streamline SDK for Web3 Developers**

FluidSDK is a comprehensive TypeScript/JavaScript SDK that enables Web3 developers to build, register, and manage AI agents with seamless payment integration through the X402 protocol. It provides a complete solution for agent identity management, reputation tracking, MCP (Model Context Protocol) integration, and decentralized feedback systems.

## 🚀 Features

- **🤖 Agent Registry**: Register and manage AI agents on-chain with ERC-8004 compliance
- **💳 X402 Payment Integration**: Built-in support for HTTP 402 payment flows
- **🔗 MCP Protocol Support**: Native integration with Model Context Protocol servers
- **📊 Reputation System**: On-chain feedback and reputation tracking
- **🌐 Multi-Chain**: Support for multiple EVM-compatible networks
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
RPC_URL=https://your-rpc-endpoint.com
PRIVATE_KEY=your_private_key_here
CHAIN_ID=11155111
PINATA_JWT=your_pinata_jwt_token
```

### 2. Initialize the SDK

```typescript
import { FluidSDK } from "fluidsdk";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Create a signer
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!);

// Initialize SDK
const sdk = new FluidSDK({
  chainId: parseInt(process.env.CHAIN_ID!),
  rpcUrl: process.env.RPC_URL!,
  signer: signer,
  ipfs: "pinata",
  pinataJwt: process.env.PINATA_JWT,
});

// Wait for initialization
const chainId = await sdk.chainId();
console.log("✅ SDK initialized on chain:", chainId);
```

## 📚 Core Functions

### Creating and Registering an Agent

```typescript
// Create agent configuration
const agent = sdk.createAgent({
  name: "My AI Assistant",
  description: "A helpful AI agent for crypto tasks",
  image: "https://example.com/agent-image.png",
  x402support: true, // Enable X402 payment protocol
  metadata: { 
    category: "DeFi",
    version: "1.0.0",
    createdBy: "Developer Name"
  },
  active: true,
  owners: [signer.address as `0x${string}`],
});

// Register on-chain with IPFS metadata
const registration = await agent.registerIPFS();
console.log("Agent ID:", registration.agentId);
console.log("IPFS URI:", registration.agentURI);
```

**Parameters:**
- `name` (string): Agent name
- `description` (string): Agent description
- `image` (string, optional): Image URL
- `x402support` (boolean): Enable X402 payment protocol
- `metadata` (object, optional): Custom metadata
- `active` (boolean): Agent active status
- `owners` (array): Array of owner addresses

**Returns:** Promise<RegistrationFile> with `agentId` and `agentURI`

### Adding MCP Server Integration

```typescript
// Configure MCP endpoint (Model Context Protocol)
await agent.setMCP(
  "https://your-mcp-server.com/mcp",  // MCP server URL
  "2024-11-05",                        // Protocol version
  true                                 // Auto-fetch capabilities
);

// Register agent with MCP capabilities
const registration = await agent.registerIPFS();
```

**Parameters:**
- `endpoint` (string): MCP server URL
- `version` (string, optional): Protocol version (default: "2025-06-18")
- `autoFetch` (boolean, optional): Auto-fetch server capabilities (default: true)

**Returns:** Promise<Agent> (chainable)

### Querying Agents

#### Get Specific Agent

```typescript
const agent = await sdk.getAgent("chainId:tokenId");

console.log("Agent Name:", agent.name);
console.log("Description:", agent.description);
console.log("Active:", agent.active);
console.log("Owners:", agent.owners);
console.log("MCP Enabled:", agent.mcp);
console.log("MCP Tools:", agent.mcpTools);
console.log("MCP Prompts:", agent.mcpPrompts);
console.log("MCP Resources:", agent.mcpResources);
```

**Parameters:**
- `agentId` (string): Format "chainId:tokenId"

**Returns:** Promise<AgentSummary> with agent details

#### Search Agents with Filters

```typescript
const results = await sdk.searchAgents(
  {
    active: true,
    x402support: true,
    name: "AI",
    mcpTools: ["calculate", "weather"]
  },
  undefined,  // cursor for pagination
  10          // limit
);

console.log(`Found ${results.items.length} agents`);
results.items.forEach(agent => {
  console.log(`- ${agent.name} (${agent.agentId})`);
});
```

**Parameters:**
- `filters` (object, optional): Search filters
  - `active` (boolean): Filter by active status
  - `x402support` (boolean): Filter by X402 support
  - `name` (string): Search by name
  - `mcpTools` (string[]): Filter by MCP tools
  - `a2aSkills` (string[]): Filter by A2A skills
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional): Results per page (default: 100)

**Returns:** Promise<SearchResults<AgentSummary>>

### Loading Agent for Modifications

```typescript
// Load existing agent
const agent = await sdk.loadAgent("chainId:tokenId");

// Update agent information
await agent.updateInfo(
  "Updated Agent Name",
  "Updated description",
  "https://new-image-url.com"
);

// Set custom metadata
await agent.setMetadata("apiEndpoint", "https://api.example.com");
await agent.setMetadata("version", "2.0.0");

// Add operators
await agent.addOperators([
  "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
]);
```

**updateInfo Parameters:**
- `name` (string, optional): New agent name
- `description` (string, optional): New description
- `image` (string, optional): New image URL

**setMetadata Parameters:**
- `key` (string): Metadata key
- `value` (string): Metadata value

**addOperators Parameters:**
- `addresses` (string[]): Array of operator addresses

### Feedback System

#### Submit Feedback

```typescript
// Prepare feedback
const feedbackFile = sdk.prepareFeedback(
  "chainId:tokenId",                          // agentId
  5,                                          // score (1-5)
  ["helpful", "accurate", "fast"],            // tags (up to 3)
  "Great agent, very responsive!",            // text review
  "natural-language",                         // capability
  "My AI Assistant",                          // agent name
  "question-answering",                       // skill
  "crypto-query",                             // task
  { sessionId: "abc123", duration: "5min" },  // context (object)
  undefined,                                  // proofOfPayment (tx hash)
  { automated: false, clientApp: "MyDApp" }   // extra metadata
);

// Submit feedback on-chain
const feedback = await sdk.giveFeedback(
  "chainId:tokenId",
  feedbackFile
);

console.log("Feedback ID:", feedback.id);
console.log("Score:", feedback.score);
console.log("Reviewer:", feedback.reviewer);
```

**prepareFeedback Parameters:**
- `agentId` (string): Agent identifier
- `score` (number): Rating 1-5
- `tags` (string[]): Up to 3 tags
- `text` (string): Review text
- `capability` (string): Capability being reviewed
- `name` (string): Agent name
- `skill` (string): Skill being reviewed
- `task` (string): Task performed
- `context` (object): Additional context
- `proofOfPayment` (string, optional): Payment transaction hash
- `extra` (object, optional): Extra metadata

**Returns:** Promise<Feedback> with feedback details

#### Query Feedback

```typescript
// Get specific feedback
const feedback = await sdk.getFeedback(
  "chainId:tokenId",                    // agentId
  "0x742d35Cc6634C0532925a3b844Bc454e", // reviewer address
  0                                     // feedback index
);

// Search feedback with filters
const feedbacks = await sdk.searchFeedback(
  "chainId:tokenId",  // agentId
  ["helpful"],        // tags filter
  ["ai-chat"],        // capabilities filter
  ["coding"],         // skills filter
  4,                  // minScore
  5                   // maxScore
);

feedbacks.forEach(fb => {
  console.log(`Score: ${fb.score}`);
  console.log(`Tags: ${fb.tags}`);
  console.log(`Text: ${fb.text}`);
  console.log(`Reviewer: ${fb.reviewer}`);
});
```

**searchFeedback Parameters:**
- `agentId` (string): Agent identifier
- `tags` (string[], optional): Filter by tags
- `capabilities` (string[], optional): Filter by capabilities
- `skills` (string[], optional): Filter by skills
- `minScore` (number, optional): Minimum score filter
- `maxScore` (number, optional): Maximum score filter

**Returns:** Promise<Feedback[]>

### Reputation Summary

```typescript
// Get agent reputation
const reputation = await sdk.getReputationSummary("chainId:tokenId");

console.log("Total Feedback:", reputation.count);
console.log("Average Score:", reputation.averageScore);
console.log("Reputation:", reputation.averageScore * 20 + "%");
```

**Parameters:**
- `agentId` (string): Agent identifier

**Returns:** Promise<ReputationSummary>
- `count` (number): Total feedback count
- `averageScore` (number): Average score (0-5)

### Advanced: A2A Integration

```typescript
// Configure A2A endpoint (Agent-to-Agent communication)
await agent.setA2A(
  "https://your-a2a-server.com",
  "1.0.0",
  true  // auto-fetch skills
);
```

**Parameters:**
- `endpoint` (string): A2A server URL
- `version` (string, optional): Protocol version
- `autoFetch` (boolean, optional): Auto-fetch server skills

### Utility Functions

```typescript
// Get supported chain IDs
const chains = sdk.supportedChains();
console.log("Supported chains:", chains);

// Get registry addresses for current chain
const registries = sdk.registries();
console.log("Identity Registry:", registries.IDENTITY);
console.log("Reputation Registry:", registries.REPUTATION);

// Get all MCP tools from subgraph
const allTools = await sdk.getAllMcpTools();
console.log("Available MCP tools:", allTools);

// Get all MCP prompts
const allPrompts = await sdk.getAllMcpPrompts();

// Get all MCP resources
const allResources = await sdk.getAllMcpResources();
```

## 🔑 X402 Protocol: Payment-Gated AI Agents

FluidSDK includes built-in support for the **X402 protocol**, enabling monetization of AI agent services.

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
      perQuery: "0.001",
      perMinute: "0.01",
      currency: "ETH"
    }
  },
  active: true,
  owners: [signer.address as `0x${string}`],
});
```

### Payment Flow Example

```typescript
// 1. User requests service (HTTP 402 response with payment details)
// 2. User makes payment transaction
// 3. Include payment proof in feedback

const feedbackWithPayment = sdk.prepareFeedback(
  agentId,
  5,
  ["paid", "quality"],
  "Worth the payment!",
  "premium-query",
  agentName,
  "advanced-analysis",
  "market-prediction",
  { 
    paymentAmount: "0.001",
    paymentToken: "ETH"
  },
  "0xPaymentTransactionHash" // Payment proof
);

await sdk.giveFeedback(agentId, feedbackWithPayment);
```

## 📊 TypeScript Types

The SDK is fully typed with TypeScript. Key interfaces:

```typescript
interface AgentConfig {
  name: string;
  description: string;
  image?: string;
  x402support: boolean;
  metadata?: Record<string, any>;
  active: boolean;
  owners: `0x${string}`[];
}

interface AgentSummary {
  chainId: number;
  agentId: string;
  name: string;
  description: string;
  image?: string;
  owners: string[];
  operators: string[];
  mcp: boolean;
  a2a: boolean;
  mcpTools: string[];
  mcpPrompts: string[];
  mcpResources: string[];
  a2aSkills: string[];
  active: boolean;
  x402support: boolean;
}

interface Feedback {
  id: [number, string, number];
  agentId: string;
  reviewer: string;
  score: number;
  tags: string;
  text: string;
  capability: string;
  skill: string;
  task: string;
  context: string;
  proofOfPayment?: string;
  createdAt: number;
}

interface ReputationSummary {
  count: number;
  averageScore: number;
}
```

## 🛠️ Error Handling

```typescript
try {
  const agent = await sdk.getAgent("chainId:tokenId");
  console.log("Agent found:", agent.name);
} catch (error) {
  if (error instanceof Error) {
    console.error("Error fetching agent:", error.message);
  }
}

// Check if agent exists before operations
const agent = await sdk.getAgent("chainId:tokenId");
if (agent) {
  // Agent exists, proceed with operations
  const feedback = await sdk.searchFeedback(agent.agentId);
} else {
  console.log("Agent not found");
}
```

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

## 🔗 Links

- [GitHub Repository](https://github.com/ShahSujal/FluidSdk)
- [Full Documentation](https://github.com/ShahSujal/FluidSdk#readme)
- [NPM Package](https://www.npmjs.com/package/fluidsdk)

## 📝 License

ISC License

---

**Built for Web3 developers who want to seamlessly integrate AI agents with blockchain payments and identity management.**
