// Type-checking shim: lets `npm run typecheck:functions` check the Deno edge
// functions with the regular TypeScript compiler. Not used at runtime.
declare namespace Deno {
  const env: { get(name: string): string | undefined }
  function serve(handler: (req: Request) => Response | Promise<Response>): unknown
}
