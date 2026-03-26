import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

describe("module boundaries lint", () => {
  it("rejects cross-domain infra import", async () => {
    const linter = new Linter();
    const messages = linter.verify(
      'import { PrismaAuthStore } from "@core/auth/infra/prisma-auth-store.js";\nvoid PrismaAuthStore;\n',
      {
        languageOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
        },
        rules: {
          "no-restricted-imports": [
            "error",
            {
              patterns: [
                {
                  group: ["@core/*/infra/*"],
                  message: "Import through each module's public index surface only.",
                },
              ],
            },
          ],
        },
      },
    );
    const ruleIds = messages.map((message) => message.ruleId).filter(Boolean);
    expect(ruleIds).toContain("no-restricted-imports");
  });
});
