
import { DEFAULT_SUBGRAPH_URLS } from './contracts.js';

export const GET_AGENTS_QUERY = `
  query GetAgents($first: Int!, $orderBy: String!, $orderDirection: String!) {
    agents(
      first: $first
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      chainId
      agentId
      agentURI
      agentURIType
      owner
      operators
      createdAt
      updatedAt

      registrationFile {
        id
        cid
        name
        description
        agentId
        mcpTools
        mcpPrompts
        mcpResources
        mcpEndpoint
        image
        active
        mcpVersion
        agentWalletChainId
        createdAt
      }

      feedback {
        id
        feedbackUri
        score
        tag1
        tag2
      }

      validations {
        validatorAddress
      }

      metadata {
        id
        key
        value
        updatedAt
      }

      totalFeedback
      lastActivity
    }
  }
`;

export const GET_AGENT_BY_ID_QUERY = `
  query GetAgentById($agentId: BigInt!) {
    agents(
      where: { agentId: $agentId }
      first: 1
    ) {
      id
      chainId
      agentId
      agentURI
      agentURIType
      owner
      operators
      createdAt
      updatedAt

      registrationFile {
        id
        cid
        name
        description
        agentId
        mcpTools
        mcpPrompts
        mcpResources
        mcpEndpoint
        image
        active
        mcpVersion
        agentWalletChainId
        createdAt
      }

      feedback {
        id
        feedbackUri
        score
        tag1
        tag2
      }

      validations {
        validatorAddress
      }

      metadata {
        id
        key
        value
        updatedAt
      }

      totalFeedback
      lastActivity
    }
  }
`;


interface ToolPricing {
  price: string;
  network: string;
  tokens: Array<{
    address: string;
    symbol: string;
    decimals: number;
  }>;
  chainId: number;
}

interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
}

export interface Tool {
  name: string;
  description: string;
  endpoint: string;
  parameters: ToolParameter[];
  pricing: ToolPricing;
  mcpServerUrl?: string;
}
let agentMetadataCache: Map<string, any> = new Map();

// Helper function to get GraphQL endpoint by chainId
function getGraphQLEndpoint(chainId?: number): string {
  const targetChainId = chainId || 97; // Default to BNB testnet
  const endpoint = DEFAULT_SUBGRAPH_URLS[targetChainId as keyof typeof DEFAULT_SUBGRAPH_URLS];
  if (!endpoint) {
    throw new Error(`No subgraph URL found for chainId ${targetChainId}`);
  }
  return endpoint;
}

export interface  IPFSMetadata {
  type: string;
  name: string;
  description: string;
  image?: string;
  creatorAddress: string;
  tools?: Tool[];
  endpoints?: Array<{
    name: string;
    endpoint: string;
    version?: string;
    mcpTools?: string[];
    mcpPrompts?: string[];
    mcpResources?: string[];
  }>;
  active: boolean;
  x402support: boolean;
  pricing?: {
    defaultPrice?: string;
    currency?: string;
    network?: string;
    token?: string;
  };
}


export interface AgentDataType {
  id: string;
  chainId: string;
  agentId: string;
  agentURI: string;
  agentURIType: string;
  owner: string;
  operators: string[];
  createdAt: string;
  updatedAt: string;
  registrationFile: {
    id: string;
    cid: string;
    name: string;
    description: string;
    agentId: string;
    mcpTools: string[];
    mcpPrompts: string[];
    mcpResources: string[];
    mcpEndpoint: string;
    image: string;
    active: boolean;
    mcpVersion: string;
    agentWalletChainId: string;
    createdAt: string;
  };
  feedback: Array<{
    id: string;
    feedbackUri: string;
    score: number;
    tag1: string;
    tag2: string;
  }>;
  validations: Array<{
    validatorAddress: string;
  }>;
  metadata: Array<{
    id: string;
    key: string;
    value: string;
    updatedAt: string;
  }>;
  totalFeedback: string;
  lastActivity: string;
}

export interface AgentsResponse {
  agents: AgentDataType[];
}
 
export const getAvailableTools = async(chainId?: number): Promise<Tool[]> => {

  const agents = await fetchAgents(50, 'totalFeedback', 'desc', chainId);

  const tools: Tool[] = [];

  for (const agent of agents) {
    try {
      const ipfsUri = agent.agentURI.replace(
        "ipfs://",
        "https://ipfs.io/ipfs/"
      );
      const response = await fetch(ipfsUri);
      const metadata = await response.json() as IPFSMetadata;

      // Cache agent metadata for later use
      const mcpServerUrl = agent.registrationFile?.mcpEndpoint || "";
      if (mcpServerUrl) {
        // Calculate average rating from feedback
        let averageRating = 0;
        if (agent.feedback && agent.feedback.length > 0) {
          const totalScore = agent.feedback.reduce((sum, f) => sum + (f.score || 0), 0);
          averageRating = totalScore / agent.feedback.length;
        }

        agentMetadataCache.set(mcpServerUrl, {
          name: agent.registrationFile?.name || metadata.name,
          description: agent.registrationFile?.description || metadata.description,
          image: agent.registrationFile?.image || metadata.image,
          rating: averageRating,
          feedbackCount: agent.feedback?.length || 0,
        });
      }

      if (metadata.tools && metadata.tools.length > 0) {
        // Add the MCP server URL from the agent's registration file
        const toolsWithUrl = metadata.tools.map((tool) => ({
          ...tool,
          mcpServerUrl,
        }));
        tools.push(...toolsWithUrl);
      }
    } catch (error) {
      console.error(`Error fetching tools for agent ${agent.agentId}:`, error);
    }
  }

  return tools;
}


export async function fetchAgents(
  first: number = 50,
  orderBy: string = 'totalFeedback',
  orderDirection: 'asc' | 'desc' = 'desc',
  chainId?: number
): Promise<AgentDataType[]> {
  try {
    const GRAPHQL_ENDPOINT = getGraphQLEndpoint(chainId);
    
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: GET_AGENTS_QUERY,
        variables: {
          first,
          orderBy,
          orderDirection,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json() as { data: AgentsResponse; errors?: any[] };

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error('Failed to fetch agents');
    }

    return result.data.agents;
  } catch (error) {
    console.error('Error fetching agents:', error);
    throw error;
  }
}

// Helper function to decode hex metadata values
export function decodeHexValue(hexValue: string): string {
  try {
    // Remove 0x prefix
    const hex = hexValue.startsWith('0x') ? hexValue.slice(2) : hexValue;
    // Convert hex to string
    return Buffer.from(hex, 'hex').toString('utf8');
  } catch (error) {
    console.error('Error decoding hex value:', error);
    return hexValue;
  }
}

// Helper function to get metadata value by key
export function getMetadataValue(agent: AgentDataType, key: string): string | null {
  const metadata = agent.metadata.find(m => m.key === key);
  return metadata ? decodeHexValue(metadata.value) : null;
}

// Helper function to calculate average rating from feedback
export function calculateAverageRating(feedback: AgentDataType['feedback']): number {
  if (!feedback || feedback.length === 0) return 0;
  
  const totalScore = feedback.reduce((sum, item) => sum + item.score, 0);
  return Math.round((totalScore / feedback.length) * 10) / 10; // Round to 1 decimal
}

// Helper function to convert score to 5-star rating
export function scoreToStars(score: number): number {
  return Math.min(5, Math.max(0, score / 20)); // Convert 0-100 score to 0-5 stars
}

// Fetch a single agent by ID
export async function fetchAgentById(agentId: string, chainId?: number): Promise<AgentDataType | null> {
  try {
    const GRAPHQL_ENDPOINT = getGraphQLEndpoint(chainId);
    
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: GET_AGENT_BY_ID_QUERY,
        variables: {
          agentId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json() as { data: AgentsResponse; errors?: any[] };

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error('Failed to fetch agent');
    }

    return result.data.agents[0] || null;
  } catch (error) {
    console.error('Error fetching agent:', error);
    throw error;
  }
}
