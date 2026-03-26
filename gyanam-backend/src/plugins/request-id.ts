import { randomUUID } from "node:crypto";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

export default fp(async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    const incoming = request.headers["x-request-id"];
    const requestId = typeof incoming === "string" && incoming.trim().length > 0 ? incoming : randomUUID();
    request.requestId = requestId;
    request.headers["x-request-id"] = requestId;
    request.log = request.log.child({ requestId });
    reply.header("x-request-id", requestId);
  });
});
