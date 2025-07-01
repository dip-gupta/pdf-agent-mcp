/**
 * PDF Agent MCP Server for Cloudflare Workers
 * A Model Context Protocol server for dynamic PDF content extraction and analysis.
 * Built following Cloudflare's recommended patterns for MCP servers.
 */

import { z } from "zod";
import { PDFDocument } from "pdf-lib";

// Environment interface for Cloudflare Workers
interface Env {
  MCP_OBJECT: DurableObjectNamespace;
}

// Cloudflare Workers types
interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectId {}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

// MCP Message types
interface MCPRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

// Tool schemas using Zod for validation
const GetPdfMetadataSchema = z.object({
  pdfData: z.string().describe("Base64 encoded PDF file data"),
});

const GetPdfTextSchema = z.object({
  pdfData: z.string().describe("Base64 encoded PDF file data"),
  pageRange: z.string().optional().describe("Page range (e.g., '1:5', '2,4,6', '3:' for page 3 to end)"),
});

const SearchPdfSchema = z.object({
  pdfData: z.string().describe("Base64 encoded PDF file data"),
  searchText: z.string().describe("Text to search for in the PDF"),
  regex: z.boolean().optional().describe("Whether to treat searchText as a regular expression"),
  caseSensitive: z.boolean().optional().describe("Whether the search should be case sensitive"),
  contextLines: z.number().optional().describe("Number of lines of context around matches"),
});

const GetPdfOutlineSchema = z.object({
  pdfData: z.string().describe("Base64 encoded PDF file data"),
});

const DownloadPdfSchema = z.object({
  url: z.string().url().describe("URL of the PDF to download"),
});

// PDF processing utilities
class PDFProcessor {
  static async getPdfMetadata(pdfData: string) {
    try {
      const pdfBytes = this.base64ToUint8Array(pdfData);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      const pageCount = pdfDoc.getPageCount();
      const title = pdfDoc.getTitle() || "Unknown";
      const author = pdfDoc.getAuthor() || "Unknown";
      const subject = pdfDoc.getSubject() || "";
      const creator = pdfDoc.getCreator() || "Unknown";
      const producer = pdfDoc.getProducer() || "Unknown";
      const creationDate = pdfDoc.getCreationDate();
      const modificationDate = pdfDoc.getModificationDate();

      return {
        success: true,
        metadata: {
          pageCount,
          title,
          author,
          subject,
          creator,
          producer,
          creationDate: creationDate?.toISOString() || null,
          modificationDate: modificationDate?.toISOString() || null,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to extract PDF metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static async extractTextFromPdf(pdfData: string, pageRange?: string) {
    try {
      const pdfBytes = this.base64ToUint8Array(pdfData);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      const totalPages = pdfDoc.getPageCount();
      const pages = this.parsePageRange(pageRange, totalPages);
      
      // Note: pdf-lib doesn't have built-in text extraction
      // This is a limitation compared to pdfjs-dist
      return {
        success: true,
        text: "Text extraction with pdf-lib is limited. Consider using pdfjs-dist for full text extraction capabilities.",
        pageCount: totalPages,
        extractedPages: pages.length,
        note: "This implementation uses pdf-lib which has limited text extraction. For full text extraction, consider using pdfjs-dist in a Node.js environment."
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static async searchInPdf(pdfData: string, searchText: string, options: { regex?: boolean; caseSensitive?: boolean; contextLines?: number } = {}) {
    try {
      // This would need proper text extraction to work effectively
      return {
        success: true,
        matches: [],
        totalMatches: 0,
        note: "Search functionality requires full text extraction capabilities not available with pdf-lib alone."
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static async getPdfOutline(pdfData: string) {
    try {
      const pdfBytes = this.base64ToUint8Array(pdfData);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // pdf-lib has limited outline extraction capabilities
      return {
        success: true,
        outline: [],
        note: "Outline extraction with pdf-lib is limited. Full outline support requires additional libraries."
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to extract PDF outline: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static async downloadPdf(url: string): Promise<{ success: boolean; pdfData?: string; error?: string; metadata?: any }> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PDF-Agent-MCP/1.0.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/pdf')) {
        throw new Error(`Expected PDF content type, got: ${contentType}`);
      }

      const pdfBytes = await response.arrayBuffer();
      const pdfData = this.uint8ArrayToBase64(new Uint8Array(pdfBytes));

      // Get basic metadata
      const metadata = await this.getPdfMetadata(pdfData);

      return {
        success: true,
        pdfData,
        metadata: metadata.success ? metadata.metadata : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to download PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private static base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private static uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binaryString);
  }

  private static parsePageRange(range: string | undefined, totalPages: number): number[] {
    if (!range) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: number[] = [];
    const parts = range.split(',');

    for (const part of parts) {
      if (part.includes(':')) {
        const [start, end] = part.split(':').map(s => s.trim());
        const startPage = start ? parseInt(start) : 1;
        const endPage = end ? parseInt(end) : totalPages;
        
        for (let i = startPage; i <= Math.min(endPage, totalPages); i++) {
          if (i > 0) pages.push(i);
        }
      } else {
        const page = parseInt(part.trim());
        if (page > 0 && page <= totalPages) {
          pages.push(page);
        }
      }
    }

    return [...new Set(pages)].sort((a, b) => a - b);
  }
}

class PDFAgentMCPServer {
  private tools = [
    {
      name: "get_pdf_metadata",
      description: "Extract metadata from a PDF file including title, author, page count, etc.",
      inputSchema: {
        type: "object",
        properties: {
          pdfData: { type: "string", description: "Base64 encoded PDF file data" }
        },
        required: ["pdfData"]
      }
    },
    {
      name: "get_pdf_text",
      description: "Extract text content from a PDF file with optional page range specification",
      inputSchema: {
        type: "object",
        properties: {
          pdfData: { type: "string", description: "Base64 encoded PDF file data" },
          pageRange: { type: "string", description: "Page range (e.g., '1:5', '2,4,6', '3:' for page 3 to end)" }
        },
        required: ["pdfData"]
      }
    },
    {
      name: "search_pdf",
      description: "Search for text within a PDF file with various options",
      inputSchema: {
        type: "object",
        properties: {
          pdfData: { type: "string", description: "Base64 encoded PDF file data" },
          searchText: { type: "string", description: "Text to search for" },
          regex: { type: "boolean", description: "Whether to treat searchText as a regular expression" },
          caseSensitive: { type: "boolean", description: "Whether the search should be case sensitive" },
          contextLines: { type: "number", description: "Number of lines of context around matches" }
        },
        required: ["pdfData", "searchText"]
      }
    },
    {
      name: "get_pdf_outline",
      description: "Extract the outline/bookmarks from a PDF file",
      inputSchema: {
        type: "object",
        properties: {
          pdfData: { type: "string", description: "Base64 encoded PDF file data" }
        },
        required: ["pdfData"]
      }
    },
    {
      name: "download_pdf",
      description: "Download a PDF from a URL and return its base64 encoded data",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL of the PDF to download" }
        },
        required: ["url"]
      }
    }
  ];

  async handleToolCall(toolName: string, args: any) {
    switch (toolName) {
      case "get_pdf_metadata": {
        const { pdfData } = GetPdfMetadataSchema.parse(args);
        return await PDFProcessor.getPdfMetadata(pdfData);
      }

      case "get_pdf_text": {
        const { pdfData, pageRange } = GetPdfTextSchema.parse(args);
        return await PDFProcessor.extractTextFromPdf(pdfData, pageRange);
      }

      case "search_pdf": {
        const { pdfData, searchText, regex, caseSensitive, contextLines } = SearchPdfSchema.parse(args);
        return await PDFProcessor.searchInPdf(pdfData, searchText, { regex, caseSensitive, contextLines });
      }

      case "get_pdf_outline": {
        const { pdfData } = GetPdfOutlineSchema.parse(args);
        return await PDFProcessor.getPdfOutline(pdfData);
      }

      case "download_pdf": {
        const { url } = DownloadPdfSchema.parse(args);
        return await PDFProcessor.downloadPdf(url);
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async handleMCPRequest(request: MCPRequest): Promise<MCPResponse | null> {
    const { method, params, id } = request;

    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id: id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: "pdf-agent-mcp",
              version: "1.0.0"
            }
          }
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id: id,
          result: {
            tools: this.tools
          }
        };

      case "tools/call":
        try {
          const { name, arguments: args } = params;
          const result = await this.handleToolCall(name, args);
          
          return {
            jsonrpc: "2.0",
            id: id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ]
            }
          };
        } catch (error) {
          return {
            jsonrpc: "2.0",
            id: id,
            error: {
              code: -1,
              message: error instanceof Error ? error.message : "Unknown error"
            }
          };
        }

      case "notifications/initialized":
        // No response needed for notifications
        return null;

      default:
        return {
          jsonrpc: "2.0",
          id: id,
          error: {
            code: -32601,
            message: "Method not found"
          }
        };
    }
  }
}

// Durable Object for handling MCP sessions
export class MyMCP {
  private env: Env;
  private server: PDFAgentMCPServer;

  constructor(state: any, env: Env) {
    this.env = env;
    this.server = new PDFAgentMCPServer();
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      
      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
          },
        });
      }
      
      // Handle SSE endpoint for MCP clients
      if (request.method === "GET" && url.pathname === "/sse") {
        // SSE connection handling
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        
        // Send initial connection event
        await writer.write(new TextEncoder().encode("event: init\ndata: {\"type\":\"connection\",\"status\":\"ready\"}\n\n"));
        
        // Keep connection alive
        const keepAlive = setInterval(async () => {
          try {
            await writer.write(new TextEncoder().encode("event: ping\ndata: {\"type\":\"ping\"}\n\n"));
          } catch (e) {
            clearInterval(keepAlive);
          }
        }, 30000);
        
        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      }
      
      // Handle HTTP POST for MCP JSON-RPC
      if (request.method === "POST" && url.pathname === "/sse") {
        const body = await request.text();
        
        try {
          const jsonRpcRequest: MCPRequest = JSON.parse(body);
          const response = await this.server.handleMCPRequest(jsonRpcRequest);
          
          // Don't send response for notifications
          if (response === null) {
            return new Response("", {
              status: 204,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
              },
            });
          }
          
          return new Response(JSON.stringify(response), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
          });
        } catch (error) {
          console.error("Error parsing MCP request:", error);
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32700,
              message: "Parse error"
            }
          }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      }
      
      // Handle GET requests for server info
      if (request.method === "GET") {
        return new Response(JSON.stringify({
          name: "pdf-agent-mcp",
          version: "1.0.0",
          description: "PDF Agent MCP Server - provides tools for PDF analysis and processing",
          protocol: "mcp",
          endpoints: {
            mcp: "/sse"
          },
          capabilities: {
            tools: ["get_pdf_metadata", "get_pdf_text", "search_pdf", "get_pdf_outline", "download_pdf"]
          }
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      return new Response("Method not allowed", { 
        status: 405,
        headers: {
          "Access-Control-Allow-Origin": "*",
        }
      });
    } catch (error) {
      console.error("Error in Durable Object fetch:", error);
      return new Response(JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error"
      }), { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }
  }
}

// Export for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    try {
      // Get or create the durable object instance
      const id = env.MCP_OBJECT.idFromName("pdf-agent-mcp");
      const durableObject = env.MCP_OBJECT.get(id);
      
      // Forward the request to the durable object
      return durableObject.fetch(request);
    } catch (error) {
      console.error("Error in main fetch handler:", error);
      return new Response(JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error"
      }), { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }
  },
};