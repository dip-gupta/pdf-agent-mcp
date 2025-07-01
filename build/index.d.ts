/**
 * PDF Agent MCP Server for Cloudflare Workers
 * A Model Context Protocol server for dynamic PDF content extraction and analysis.
 * Implements the Streamable HTTP transport protocol.
 */
interface Env {
    MCP_OBJECT: DurableObjectNamespace;
}
interface DurableObjectNamespace {
    idFromName(name: string): DurableObjectId;
    get(id: DurableObjectId): DurableObjectStub;
}
interface DurableObjectId {
}
interface DurableObjectStub {
    fetch(request: Request): Promise<Response>;
}
export declare class MyMCP {
    private env;
    private server;
    constructor(state: any, env: Env);
    fetch(request: Request): Promise<Response>;
}
declare const _default: {
    fetch(request: Request, env: Env, ctx: any): Promise<Response>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map