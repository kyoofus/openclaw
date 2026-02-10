import type { Command } from "commander";
import { Type } from "@sinclair/typebox";
// import { registerPluginHooksFromDir } from "openclaw/plugin-sdk";
import type { OpenClawPluginApi } from "../../src/plugins/types.js";
import { registerPluginHooksFromDir } from "../../src/hooks/plugin-hooks.js";

export default function register(api: OpenClawPluginApi) {
  // Register hooks from the hooks directory
  registerPluginHooksFromDir(api, "./hooks");
  // Register CLI command: `openclaw hello`
  api.registerCli(
    ({ program }: { program: Command }) => {
      program
        .command("hello")
        .description("Print Hello World")
        .action(() => {
          console.log("Hello World");
        });
    },
    { commands: ["hello"] },
  );

  // Register agent tool: `hello_world`
  api.registerTool({
    name: "hello_world",
    label: "Hello World",
    description: "Returns a Hello World greeting message",
    parameters: Type.Object({
      name: Type.Optional(Type.String({ description: "Optional name to greet" })),
    }),
    async execute(_id: string, params: { name?: string }) {
      const greeting = params.name ? `Hello, ${params.name}!` : "Hello World";
      return {
        content: [{ type: "text" as const, text: greeting }],
        details: { greeting },
      };
    },
  });

  api.logger?.info?.("kyofe-plugin plugin loaded");
}
