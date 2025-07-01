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

    range.split(',').forEach(part => {
      part = part.trim();

      if (part.includes(':')) {
        const [start, end] = part.split(':').map(s => s.trim());
        const startPage = start ? parseInt(start, 10) : 1;
        const endPage = end ? parseInt(end, 10) : totalPages;

        for (let i = Math.max(1, startPage); i <= Math.min(totalPages, endPage); i++) {
          if (!pages.includes(i)) pages.push(i);
        }
      } else {
        const pageNum = parseInt(part, 10);
        if (pageNum >= 1 && pageNum <= totalPages && !pages.includes(pageNum)) {
          pages.push(pageNum);
        }
      }
    });

    return pages.sort((a, b) => a - b);
  }
}

// MCP Server Implementation
class PDFAgentMCPServer {
  private tools = [
    {
      name: "get_pdf_metadata",
      description: "Extract metadata from a PDF file",
      inputSchema: GetPdfMetadataSchema.shape,
    },
    {
      name: "get_pdf_text", 
      description: "Extract text content from a PDF file with optional page range",
      inputSchema: GetPdfTextSchema.shape,
    },
    {
      name: "search_pdf",
      description: "Search for text within a PDF file with optional regex and context",
      inputSchema: SearchPdfSchema.shape,
    },
    {
      name: "get_pdf_outline",
      description: "Extract the outline/table of contents from a PDF file",
      inputSchema: GetPdfOutlineSchema.shape,
    },
    {
      name: "download_pdf",
      description: "Download a PDF from a URL and return its base64 data",
      inputSchema: DownloadPdfSchema.shape,
    },
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

  async handleMCPRequest(request: any) {
    const { method, params } = request;

    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id: request.id,
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
          id: request.id,
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
            id: request.id,
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
            id: request.id,
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
          id: request.id,
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
      
      // Handle both root (/) and /sse paths for MCP connections
      if (request.method === "POST" && (url.pathname === "/" || url.pathname === "/sse")) {
        const body = await request.text();
        const jsonRpcRequest = JSON.parse(body);
        
        const response = await this.server.handleMCPRequest(jsonRpcRequest);
        
        // Don't send response for notifications
        if (response === null) {
          return new Response("", {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          });
        }
        
        return new Response(JSON.stringify(response), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
      
      if (request.method === "GET" && url.pathname === "/sse") {
        // Handle SSE connection for MCP
        return new Response("data: {\"type\":\"connection\",\"status\":\"connected\"}\n\n", {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
      
      if (request.method === "GET") {
        return new Response(JSON.stringify({
          name: "pdf-agent-mcp",
          version: "1.0.0",
          description: "PDF Agent MCP Server - provides tools for PDF analysis and processing",
          endpoints: {
            sse: "/sse",
            tools: ["get_pdf_metadata", "get_pdf_text", "search_pdf", "get_pdf_outline", "download_pdf"]
          }
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      return new Response("Method not allowed", { status: 405 });
    } catch (error) {
      console.error("Error in Durable Object fetch:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
}

// Export for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    // Get or create the durable object instance
    const id = env.MCP_OBJECT.idFromName("pdf-agent-mcp");
    const durableObject = env.MCP_OBJECT.get(id);
    
    // Forward the request to the durable object
    return durableObject.fetch(request);
  },
};