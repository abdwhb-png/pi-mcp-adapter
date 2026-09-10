import { createConnection, Socket } from "node:net";
import { UnixSocketClientTransport } from "../unix-socket-transport.ts";

vi.mock(import("node:net"), async original => ({
  ...await original(),
  createConnection: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

describe("UnixSocketClientTransport", () => {
  it.each(["buffer", "text"])("decodes fragmented %s messages", async encoding => {
    const socket = new Socket();
    vi.mocked(createConnection).mockReturnValue(socket);
    const transport = new UnixSocketClientTransport("/unused-test-socket");
    const messages = vi.fn();
    const errors = vi.fn();
    transport.onmessage = messages;
    transport.onerror = errors;
    try {
      const started = transport.start();
      socket.emit("connect");
      await started;
      const message = { jsonrpc: "2.0", id: 1, result: { text: "été" } };
      const wire = JSON.stringify(message) + "\n";
      for (const part of [wire.slice(0, 8), wire.slice(8)]) {
        socket.emit("data", encoding === "buffer" ? Buffer.from(part) : part);
      }
      expect(errors).not.toHaveBeenCalled();
      expect(messages).toHaveBeenCalledTimes(1);
      expect(messages).toHaveBeenCalledWith(message);
    } finally {
      socket.destroy();
      await transport.close();
    }
  });
});
