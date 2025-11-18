import axios from "axios";
import { ethers } from 'ethers';
import {
  type Signer,
  withPaymentInterceptor,
} from "x402-axios";
import { DEFAULT_REGISTRIES } from "./contracts.js";


export interface FeedbackParams {
  agentId: string; // Format: chainId:tokenId
  score?: number; // 0-100
  tags?: string[];
  text?: string;
  capability?: string;
  name?: string;
  skill?: string;
  task?: string;
  context?: Record<string, unknown>;
  proofOfPayment?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

export interface ContractConfig {
  chainId: number;
  rpcUrl: string;
  pinataJwt?: string;
  pinataGateway?: string;
}

export class ExecuteTask {
  private executeTask = async ({
    endpoint,
    mcpServerUrl,
    parameters,
    signer,
  }: {
    endpoint: string;
    mcpServerUrl: string;
    parameters: Record<string, any>;
    signer: Signer;
  }) => {
    try {
      // Wrap axios with payment interceptor
      const api = withPaymentInterceptor(
        axios.create({
          baseURL: mcpServerUrl,
        }),
        signer
      );

      // ❗ WAIT for the paid request to finish
      const response = await api.get(endpoint, { params: parameters });

      // x402 payment header (optional)
      const rawHeader = response.headers["x-payment-response"];
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error("X402 Request Failed:", error?.response?.data || error);

      return {
        success: false,
        error: error?.response?.data || error?.message,
      };
    }
  };

  public executeAgentTask = async ({
    agentEndpoint,
    mcpServerUrl,
    parameters,
    signer,
  }: {
    agentEndpoint: string;
    mcpServerUrl: string;
    parameters: Record<string, any>;
    signer: Signer;
  }) => {
    return await this.executeTask({
      endpoint: agentEndpoint,
      mcpServerUrl,
      parameters,
      signer,
    });
  };

  /**
   * Execute task and submit feedback in one operation
   */
  public executeTaskWithFeedback = async ({
    agentEndpoint,
    mcpServerUrl,
    parameters,
    signer,
    feedbackParams,
    contractConfig,
  }: {
    agentEndpoint: string;
    mcpServerUrl: string;
    parameters: Record<string, any>;
    signer: Signer;
    feedbackParams: FeedbackParams;
    contractConfig: ContractConfig;
  }) => {
    // Execute the task first
    const taskResult = await this.executeTask({
      endpoint: agentEndpoint,
      mcpServerUrl,
      parameters,
      signer,
    });

    // If task execution failed, don't submit feedback
    if (!taskResult.success) {
      return {
        taskResult,
        feedbackResult: null,
        error: "Task execution failed, feedback not submitted",
      };
    }

    // Submit feedback
    try {
      const feedbackResult = await this.giveFeedback({
        feedbackParams,
        contractConfig,
        signer,
      });

      return {
        taskResult,
        feedbackResult,
        success: true,
      };
    } catch (error: any) {
      return {
        taskResult,
        feedbackResult: null,
        error: `Feedback submission failed: ${error.message}`,
        success: false,
      };
    }
  };

  /**
   * Give feedback with user-passed signer
   */
  public giveFeedback = async ({
    feedbackParams,
    contractConfig,
    signer,
  }: {
    feedbackParams: FeedbackParams;
    contractConfig: ContractConfig;
    signer: Signer;
  }) => {

       const defaultRegistries = DEFAULT_REGISTRIES[contractConfig.chainId] || {};
    if (!defaultRegistries.IDENTITY || !defaultRegistries.REPUTATION) {
      throw new Error(`No default registries found for chainId ${contractConfig.chainId}`);
    }

    const identityRegistryAddress = defaultRegistries.IDENTITY;
    const reputationRegistryAddress = defaultRegistries.REPUTATION;
    // Parse agent ID
    const agentIdParts = feedbackParams.agentId.split(':');
    if (agentIdParts.length !== 2 || !agentIdParts[0] || !agentIdParts[1]) {
      throw new Error('Invalid agentId format. Expected chainId:tokenId');
    }
    const chainId = parseInt(agentIdParts[0], 10);
    const tokenId = parseInt(agentIdParts[1], 10);

    // Setup provider and wallet from signer
    const provider = new ethers.JsonRpcProvider(contractConfig.rpcUrl);
    let wallet: ethers.Wallet;
    
    if (typeof signer === 'string') {
      wallet = new ethers.Wallet(signer, provider);
    } else if (signer instanceof ethers.Wallet) {
      wallet = signer.connect(provider);
    } else {
      throw new Error('Unsupported signer type');
    }

    const clientAddress = wallet.address;

    // Setup contracts
    const reputationRegistryAbi = [
      "function getLastIndex(uint256 tokenId, address client) external view returns (uint256)",
      "function giveFeedback(uint256 tokenId, uint256 score, bytes32 tag1, bytes32 tag2, string calldata feedbackUri, bytes32 feedbackHash, bytes calldata feedbackAuth) external",
    ];

    const reputationRegistry = new ethers.Contract(
      reputationRegistryAddress,
      reputationRegistryAbi,
      wallet
    );

    // Get current feedback index
    let feedbackIndex: number;
    try {
      const getLastIndexMethod = reputationRegistry.getLastIndex;
      if (!getLastIndexMethod) {
        throw new Error('getLastIndex method not found on contract');
      }
      const lastIndex = await getLastIndexMethod(BigInt(tokenId), clientAddress);
      feedbackIndex = Number(lastIndex) + 1;
    } catch (error) {
      feedbackIndex = 1;
    }

    // Prepare feedback file
    const feedbackFile = this.prepareFeedback(
      feedbackParams.agentId,
      clientAddress,
      chainId,
      identityRegistryAddress,
      feedbackParams.score,
      feedbackParams.tags,
      feedbackParams.text,
      feedbackParams.capability,
      feedbackParams.name,
      feedbackParams.skill,
      feedbackParams.task,
      feedbackParams.context,
      feedbackParams.proofOfPayment,
      feedbackParams.extra
    );
    console.log({
        feedbackFile
    });
    

    // Sign feedback auth
    const feedbackAuth = await this.signFeedbackAuth(
      tokenId,
      clientAddress,
      feedbackIndex,
      chainId,
      identityRegistryAddress,
      wallet
    );

    console.log({
      feedbackAuth
    });

    // Update feedback file with auth
    feedbackFile.feedbackAuth = feedbackAuth;

    // Prepare on-chain data
    const score = feedbackFile.score !== undefined ? Number(feedbackFile.score) : 0;
    const tag1 = this.stringToBytes32((feedbackParams.tags && feedbackParams.tags[0]) || '');
    const tag2 = this.stringToBytes32((feedbackParams.tags && feedbackParams.tags[1]) || '');

    // Handle IPFS storage
    let feedbackUri = '';
    let feedbackHash = '0x' + '00'.repeat(32);

    if (contractConfig.pinataJwt) {
      try {
        const cid = await this.uploadToIPFS(feedbackFile, contractConfig.pinataJwt, contractConfig.pinataGateway);
        feedbackUri = `ipfs://${cid}`;
        const sortedJson = JSON.stringify(feedbackFile, Object.keys(feedbackFile).sort());
        feedbackHash = ethers.keccak256(ethers.toUtf8Bytes(sortedJson));
      } catch (error) {
        console.warn('Failed to upload to IPFS:', error);
      }
    }
    console.log({
        feedbackUri
    });
    
    // Submit to blockchain
    const giveFeedbackMethod = reputationRegistry.giveFeedback;
    if (!giveFeedbackMethod) {
      throw new Error('giveFeedback method not found on contract');
    }
    
    const tx = await giveFeedbackMethod(
      BigInt(tokenId),
      score,
      tag1,
      tag2,
      feedbackUri,
      feedbackHash,
      ethers.getBytes(feedbackAuth)
    );

    console.log({
        tx
    });
    
    const receipt = await tx.wait();

    return {
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      feedbackIndex,
      feedbackFile,
      feedbackUri,
    };
  };

  /**
   * Sign feedback authorization
   */
  private signFeedbackAuth = async (
    tokenId: number,
    clientAddress: string,
    indexLimit: number,
    chainId: number,
    identityRegistryAddress: string,
    wallet: ethers.Wallet,
    expiryHours: number = 24
  ): Promise<string> => {
    const expiry = BigInt(Math.floor(Date.now() / 1000) + expiryHours * 3600);
    const signerAddress = wallet.address;

    // Encode feedback auth data (matching contract's abi.encode)
    const authData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'address', 'uint256', 'uint256', 'uint256', 'address', 'address'],
      [
        BigInt(tokenId),
        clientAddress,
        BigInt(indexLimit),
        expiry,
        BigInt(chainId),
        identityRegistryAddress,
        signerAddress,
      ]
    );

    // Hash the encoded data
    const messageHash = ethers.keccak256(authData);

    // Sign the hash
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    // Combine auth data and signature
    const authDataNoPrefix = authData.startsWith('0x') ? authData.slice(2) : authData;
    const sigNoPrefix = signature.startsWith('0x') ? signature.slice(2) : signature;
    return '0x' + authDataNoPrefix + sigNoPrefix;
  };

  /**
   * Prepare feedback file according to spec
   */
  private prepareFeedback = (
    agentId: string,
    clientAddress: string,
    chainId: number,
    identityRegistryAddress: string,
    score?: number,
    tags?: string[],
    text?: string,
    capability?: string,
    name?: string,
    skill?: string,
    task?: string,
    context?: Record<string, unknown>,
    proofOfPayment?: Record<string, unknown>,
    extra?: Record<string, unknown>
  ): Record<string, unknown> => {
    const agentIdParts = agentId.split(':');
    if (agentIdParts.length !== 2 || !agentIdParts[1]) {
      throw new Error('Invalid agentId format in prepareFeedback');
    }
    const tokenId = parseInt(agentIdParts[1], 10);
    const tagsArray = tags || [];
    const createdAt = new Date().toISOString();

    const feedbackData: Record<string, unknown> = {
      agentRegistry: `eip155:${chainId}:${identityRegistryAddress}`,
      agentId: tokenId,
      clientAddress: `eip155:${chainId}:${clientAddress}`,
      createdAt,
      feedbackAuth: '',
      score: score !== undefined ? Math.round(score) : 0,
      tag1: tagsArray[0] || undefined,
      tag2: tagsArray.length > 1 ? tagsArray[1] : undefined,
      skill,
      context,
      task,
      capability,
      name,
      proofOfPayment,
    };

    // Remove undefined values
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(feedbackData)) {
      if (value !== undefined && value !== null) {
        cleaned[key] = value;
      }
    }

    if (extra) {
      Object.assign(cleaned, extra);
    }

    return cleaned;
  };

  /**
   * Convert string to bytes32
   */
  private stringToBytes32 = (text: string): string => {
    if (!text) {
      return '0x' + '00'.repeat(32);
    }

    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);
    const padded = new Uint8Array(32);
    const length = Math.min(encoded.length, 32);
    padded.set(encoded.slice(0, length), 0);

    return ethers.hexlify(padded);
  };

  /**
   * Upload feedback to IPFS using Pinata
   */
  private uploadToIPFS = async (
    data: Record<string, unknown>,
    pinataJwt: string,
    pinataGateway?: string
  ): Promise<string> => {
    const { uploadJson } = await import('pinata');
    const config = { pinataJwt };
    const result = await uploadJson(config, data, "public");
    return result.cid;
  };

  
}
