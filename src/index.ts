import { Hono } from "hono";
import { DurableObject } from "cloudflare:workers";

type Env = {
  Bindings: {
    WEBSOCKET_SERVER: DurableObjectNamespace;
  };
};

const app = new Hono<Env>();

app.get("/", (c) => {
  return c.text("Hello, World!");
});

app.get("/api/ws", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return new Response("Durable Object expected Upgrade: websocket", {
      status: 426,
    });
  }

  const id = c.env.WEBSOCKET_SERVER.idFromName("global");
  const stub = c.env.WEBSOCKET_SERVER.get(id);

  return await stub.fetch(c.req.raw);
});

class WebSocketServer extends DurableObject {
  private counter = 0;
  private webSockets: Set<WebSocket> = new Set();

  async fetch(request: Request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    this.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  acceptWebSocket(ws: WebSocket) {
    this.webSockets.add(ws);
    ws.accept();

    ws.addEventListener("message", (event: MessageEvent) => {
      console.log("Received message:", event.data);

      const strs: string[] = JSON.parse(typeof event.data === "string" ? event.data : "");
      this.broadcastMessage(strs);
      if (event.data === "clean") {
        this.counter = 0;
        return;
      }
    });

    ws.addEventListener("close", (cls: CloseEvent) => {
      this.webSockets.delete(ws);
      if (cls.code === 1000) {
        ws.close(1000, "Durable Object is closing WebSocket");
      }
    });
  }

  broadcastMessage(messages: string[]) {
    this.webSockets.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        messages.map((message) => {
          client.send(`${this.counter.toString()},${message}`);
        });
      }
    });
  }
}

export { WebSocketServer };
export default app;
