import fp from "fastify-plugin";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaCtor } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export type PrismaPluginOptions = {
  databaseUrl: string;
};

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp<PrismaPluginOptions>(async (app, options) => {
  const adapter = new PrismaPg({ connectionString: options.databaseUrl });
  const prisma = new PrismaCtor({ adapter });

  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
