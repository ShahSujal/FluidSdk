/**
 * IPFS client for decentralized storage with Pinata SDK support
 */

import { PinataSDK } from "pinata";
import type { RegistrationFile } from '../types/interfaces.js';
import { IPFS_GATEWAYS, TIMEOUTS } from '../utils/constants.js';

export interface IPFSClientConfig {
  pinataJwt?: string;
  pinataGateway?: string;
}

/**
 * Client for IPFS operations using Pinata SDK
 */
export class IPFSClient {
  private pinata: PinataSDK;
  private config: IPFSClientConfig;

  constructor(config: IPFSClientConfig) {
    if (!config.pinataJwt) {
      throw new Error('pinataJwt is required');
    }
    
    this.config = config;
    this.pinata = new PinataSDK({
      pinataJwt: config.pinataJwt,
      pinataGateway: config.pinataGateway || "https://gateway.pinata.cloud"
    });
  }

  /**
   * Add data to IPFS using Pinata SDK and return CID
   */
  async add(data: string): Promise<string> {
    try {
      const config = { pinataJwt: this.config.pinataJwt! };
      
      // Try to parse as JSON first
      try {
        const jsonData = JSON.parse(data);
        const { uploadJson } = await import('pinata');
        const result = await uploadJson(config, jsonData, "public");
        return result.cid;
      } catch {
        // If JSON parsing fails, upload as file
        const { uploadFile } = await import('pinata');
        const file = new File([data], 'data.txt', { type: 'text/plain' });
        const result = await uploadFile(config, file, "public");
        return result.cid;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to pin to Pinata: ${errorMessage}`);
    }
  }

  /**
   * Add file to IPFS and return CID
   */
  async addFile(filepath: string): Promise<string> {
    // Check if we're in Node.js environment
    if (typeof process === 'undefined' || !process.versions?.node) {
      throw new Error(
        'addFile() is only available in Node.js environments. ' +
          'For browser environments, use add() with file content directly.'
      );
    }

    try {
      const fs = await import('fs');
      const { uploadFile } = await import('pinata');
      const fileContent = fs.readFileSync(filepath);
      const fileName = filepath.split(/[\/\\]/).pop() || 'file';
      
      const file = new File([fileContent], fileName);
      const config = { pinataJwt: this.config.pinataJwt! };
      const result = await uploadFile(config, file, "public");
      return result.cid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to upload file to Pinata: ${errorMessage}`);
    }
  }

  /**
   * Get data from IPFS by CID using gateways
   */
  async get(cid: string): Promise<string> {
    // Extract CID from IPFS URL if needed
    if (cid.startsWith('ipfs://')) {
      cid = cid.slice(7); // Remove "ipfs://" prefix
    }

    // Use configured gateway or fallback to public gateways
    const gateways = [
      this.config.pinataGateway || 'https://gateway.pinata.cloud',
      ...IPFS_GATEWAYS
    ].map(gateway => `${gateway.replace(/\/$/, '')}/ipfs/${cid}`);

    // Try all gateways in parallel - use the first successful response
    const promises = gateways.map(async (gateway) => {
      try {
        const response = await fetch(gateway, {
          signal: AbortSignal.timeout(TIMEOUTS.IPFS_GATEWAY),
        });
        if (response.ok) {
          return await response.text();
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        throw error;
      }
    });

    // Use Promise.allSettled to get the first successful result
    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        return result.value;
      }
    }

    throw new Error('Failed to retrieve data from all IPFS gateways');
  }

  /**
   * Get JSON data from IPFS by CID
   */
  async getJson<T = Record<string, unknown>>(cid: string): Promise<T> {
    const data = await this.get(cid);
    return JSON.parse(data) as T;
  }

  /**
   * Pin a CID (already pinned with Pinata SDK uploads)
   */
  async pin(cid: string): Promise<{ pinned: string[] }> {
    // Files uploaded via Pinata SDK are automatically pinned
    // This method is included for compatibility
    return { pinned: [cid] };
  }

  /**
   * Unpin a CID from Pinata
   */
  async unpin(cid: string): Promise<{ unpinned: string[] }> {
    try {
      const { deleteFile } = await import('pinata');
      const config = { pinataJwt: this.config.pinataJwt! };
      await deleteFile(config, [cid], "public");
      return { unpinned: [cid] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to unpin from Pinata: ${errorMessage}`);
    }
  }

  /**
   * Add JSON data to IPFS and return CID
   */
  async addJson(data: Record<string, unknown>): Promise<string> {
    try {
      const { uploadJson } = await import('pinata');
      const config = { pinataJwt: this.config.pinataJwt! };
      const result = await uploadJson(config, data, "public");
      return result.cid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to upload JSON to Pinata: ${errorMessage}`);
    }
  }

  /**
   * Add registration file to IPFS and return CID
   */
  async addRegistrationFile(
    registrationFile: RegistrationFile,
    chainId?: number,
    identityRegistryAddress?: string,
    tools: any = []
  ): Promise<string> {
    // Convert from internal format { type, value, meta } to ERC-8004 format { name, endpoint, version }
    const endpoints: Array<Record<string, unknown>> = [];
    for (const ep of registrationFile.endpoints) {
      const endpointDict: Record<string, unknown> = {
        name: ep.type, // EndpointType enum value (e.g., "MCP", "A2A")
        endpoint: ep.value,
      };
      
      // Spread meta fields (version, mcpTools, mcpPrompts, etc.) into the endpoint dict
      if (ep.meta) {
        Object.assign(endpointDict, ep.meta);
      }
      
      endpoints.push(endpointDict);
    }
    
    // Add walletAddress as an endpoint if present
    if (registrationFile.walletAddress) {
      const walletChainId = registrationFile.walletChainId || chainId || 1;
      endpoints.push({
        name: 'agentWallet',
        endpoint: `eip155:${walletChainId}:${registrationFile.walletAddress}`,
      });
    }
    
    // Build registrations array
    const registrations: Array<Record<string, unknown>> = [];
    if (registrationFile.agentId) {
      const parts = registrationFile.agentId.split(':');
      const tokenId = parts[2];
      if (tokenId) {
        const agentRegistry = chainId && identityRegistryAddress
          ? `eip155:${chainId}:${identityRegistryAddress}`
          : `eip155:1:{identityRegistry}`;
        registrations.push({
          agentId: parseInt(tokenId, 10),
          agentRegistry,
        });
      }
    }
    
    // Build ERC-8004 compliant registration file
    const data = {
      creatorAddress: registrationFile.walletAddress,
      tools: tools,
      type: "agent",
      name: registrationFile.name,
      description: registrationFile.description,
      active: registrationFile.active,
      x402support: registrationFile.x402support,
    };
    
    return this.addJson(data);
  }

  /**
   * Get registration file from IPFS by CID
   */
  async getRegistrationFile(cid: string): Promise<RegistrationFile> {
    const data = await this.getJson<RegistrationFile>(cid);
    return data;
  }

  /**
   * Close IPFS client connection
   */
  async close(): Promise<void> {
    // Pinata SDK doesn't require explicit connection cleanup
    // This method is included for compatibility
  }
}

