/**
 * Endpoint Crawler for MCP and A2A Servers
 * Automatically fetches capabilities (tools, prompts, resources, skills) from endpoints
 */

export interface McpCapabilities {
  mcpTools?: any[];
  mcpPrompts?: any[];
  mcpResources?: any[];
  mcpToolsDetails?: any;
  mcpPromptsDetails?: any;
  mcpResourcesDetails?: any;
}

export interface A2aCapabilities {
  a2aSkills?: any[];
}

/**
 * Helper to create JSON-RPC request
 */
function createJsonRpcRequest(method: string, params?: Record<string, unknown>, requestId: number = 1) {
  return {
    jsonrpc: '2.0',
    method,
    id: requestId,
    params: params || {},
  };
}

/**
 * Crawls MCP and A2A endpoints to fetch capabilities
 */
export class EndpointCrawler {
  private timeout: number;

  constructor(timeout: number = 5000) {
    this.timeout = timeout;
  }

  /**
   * Fetch MCP capabilities (tools, prompts, resources) from an MCP server
   */
  async fetchMcpCapabilities(endpoint: string): Promise<McpCapabilities | null> {
    // Ensure endpoint is HTTP/HTTPS
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      // Invalid endpoint format - return null
      return null;
    }

    // Try JSON-RPC approach first (for real MCP servers)
    const capabilities = await this._fetchViaJsonRpc(endpoint);
    if (capabilities) {
      return capabilities;
    }

    // Fallback to static agentcard.json
    try {
      const agentcardUrl = `${endpoint}/agentcard.json`;
      const response = await fetch(agentcardUrl, {
        signal: AbortSignal.timeout(this.timeout),
        redirect: 'follow',
      });

      if (response.ok) {
        const data = await response.json();

        // Extract capabilities from agentcard
        const result: McpCapabilities = {
          mcpTools: this._extractList(data, 'tools'),
          mcpPrompts: this._extractList(data, 'prompts'),
          mcpResources: this._extractList(data, 'resources'),
        };

        if (result.mcpTools?.length || result.mcpPrompts?.length || result.mcpResources?.length) {
          return result;
        }
      }
    } catch (error) {
      // Silently fail - soft failure pattern
    }

    return null;
  }

  /**
   * Try to fetch capabilities via JSON-RPC
   */
  private async _fetchViaJsonRpc(httpUrl: string): Promise<any> {
    try {
          const tools = await fetch(`${httpUrl}/tools`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }).then(res => res.json());

          const resources = await fetch(`${httpUrl}/resources`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }).then(res => res.json()); 
          const prompts = await fetch(`${httpUrl}/prompts`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }).then(res => res.json());
            const result = {
              mcpTools: tools,
              mcpResources: resources,
              mcpPrompts: prompts,
            };
            return result;
    } catch (error) {
      // JSON-RPC approach failed - continue to fallback
    }

    return null;
  }

  /**
   * Make a JSON-RPC call and return the result
   */
  private async _jsonRpcCall(url: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    try {
      const payload = createJsonRpcRequest(method, params);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        return null;
      }

      // Check if response is SSE format
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      if (contentType.includes('text/event-stream') || text.includes('event: message')) {
        // Parse SSE format
        const result = this._parseSseResponse(text);
        if (result) {
          return result;
        }
      }

      // Regular JSON response
      const result = JSON.parse(text);
      return result;
    } catch (error) {
      // JSON-RPC call failed - continue to next method
      return null;
    }
  }

  /**
   * Parse Server-Sent Events (SSE) format response
   */
  private _parseSseResponse(sseText: string): any | null {
    try {
      // Look for "data:" lines containing JSON
      const lines = sseText.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6); // Remove "data: " prefix
          const data = JSON.parse(jsonStr);
          if (data.result !== undefined) {
            return data.result;
          }
          return data;
        }
      }
    } catch (error) {
      // Failed to parse SSE response - continue
    }
    return null;
  }

  /**
   * Fetch A2A capabilities (skills) from an A2A server
   */
  async fetchA2aCapabilities(endpoint: string): Promise<A2aCapabilities | null> {
    try {
      // Ensure endpoint is HTTP/HTTPS
      if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
        // Invalid endpoint format - skip
        return null;
      }

      // Try multiple well-known paths for A2A agent cards
      const agentcardUrls = [
        `${endpoint}/agentcard.json`,
        `${endpoint}/.well-known/agent.json`,
        `${endpoint.replace(/\/$/, '')}/.well-known/agent.json`,
      ];

      for (const agentcardUrl of agentcardUrls) {
        try {
          const response = await fetch(agentcardUrl, {
            signal: AbortSignal.timeout(this.timeout),
            redirect: 'follow',
          });

          if (response.ok) {
            const data = await response.json();

            // Extract skills from agentcard
            const skills = this._extractList(data, 'skills');

            if (skills && skills.length > 0) {
              return { a2aSkills: skills };
            }
          }
        } catch {
          // Try next URL
          continue;
        }
      }
    } catch (error) {
      // Unexpected error - continue silently
    }

    return null;
  }

  /**
   * Extract a list of strings from nested JSON data
   */
  private _extractList(data: any, key: string): string[] {
    const result: string[] = [];

    // Try top-level key
    if (key in data && Array.isArray(data[key])) {
      for (const item of data[key]) {
        if (typeof item === 'string') {
          result.push(item);
        } else if (item && typeof item === 'object') {
          // For objects, try to extract name/id field
          const nameFields = ['name', 'id', 'identifier', 'title'];
          for (const nameField of nameFields) {
            if (nameField in item && typeof item[nameField] === 'string') {
              result.push(item[nameField]);
              break;
            }
          }
        }
      }
    }

    // Try nested in 'capabilities' or 'abilities'
    if (result.length === 0) {
      const containerKeys = ['capabilities', 'abilities', 'features'];
      for (const containerKey of containerKeys) {
        if (containerKey in data && data[containerKey] && typeof data[containerKey] === 'object') {
          if (key in data[containerKey] && Array.isArray(data[containerKey][key])) {
            for (const item of data[containerKey][key]) {
              if (typeof item === 'string') {
                result.push(item);
              } else if (item && typeof item === 'object') {
                const nameFields = ['name', 'id', 'identifier', 'title'];
                for (const nameField of nameFields) {
                  if (nameField in item && typeof item[nameField] === 'string') {
                    result.push(item[nameField]);
                    break;
                  }
                }
              }
            }
          }
          if (result.length > 0) {
            break;
          }
        }
      }
    }

    return result;
  }
}

