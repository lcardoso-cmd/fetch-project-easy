import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  experimental: {
    tasks: true,
  },
  scheduledTasks: {
    "* * * * *": ["documents:process-queues"],
  },
});
