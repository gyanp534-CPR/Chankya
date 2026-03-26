import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";

export type JwtPluginOptions = {
  jwtSecret: string;
};

export const jwtPlugin = fp<JwtPluginOptions>(async (app, options) => {
  await app.register(fastifyJwt, {
    secret: options.jwtSecret,
  });
});
