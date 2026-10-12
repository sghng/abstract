/** Fetch failures carry a machine-readable code; the MCP surfaces it. */

export class FetchError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
