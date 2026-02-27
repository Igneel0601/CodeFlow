import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import { openai, createAgent, createTool, createNetwork, type Tool, type Message, createState } from "@inngest/agent-kit";

import { prisma } from "@/lib/db";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";

import { inngest } from "./client";
import { SANDBOX_TIMEOUT } from "./types";
import { getSandbox, lastAssistantTextMessageContent, parseAgentOutput } from "./utils";

const geminiBaseUrl = process.env.gemini_base_url ?? process.env.GEMINI_BASE_URL;
const geminiApiKey = process.env.gemini_api_key ?? process.env.GEMINI_API_KEY;

const codeModel = process.env.AI_CODE_MODEL ?? "gpt-4.1";
const titleModel = process.env.AI_TITLE_MODEL ?? "gpt-4o";
const responseModel = process.env.AI_RESPONSE_MODEL ?? "gpt-4o";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
};

export const codeAgentFunction = inngest.createFunction(
  {
    id: "code-agent",
    cancelOn: [{ event: "code-agent/cancel", match: "data.projectId" }],
  },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-or-create-sandbox", async () => {
      const project = await prisma.project.findUniqueOrThrow({
        where: { id: event.data.projectId },
        include: {
          messages: {
            where: { fragment: { isNot: null } },
            include: { fragment: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      // Try to reconnect to existing sandbox
      if (project.sandboxId) {
        try {
          const sandbox = await Sandbox.connect(project.sandboxId);
          await sandbox.setTimeout(SANDBOX_TIMEOUT);
          return sandbox.sandboxId;
        } catch {
          // Sandbox expired, will create a new one below
        }
      }

      // Create a new sandbox
      const sandbox = await Sandbox.create("codeflow");
      await sandbox.setTimeout(SANDBOX_TIMEOUT);

      // Restore files from last fragment if available
      const lastFragment = project.messages[0]?.fragment;
      if (lastFragment?.files) {
        const files = lastFragment.files as Record<string, string>;
        for (const [path, content] of Object.entries(files)) {
          await sandbox.files.write(path, content);
        }
      }

      // Save sandboxId to project
      await prisma.project.update({
        where: { id: event.data.projectId },
        data: { sandboxId: sandbox.sandboxId },
      });

      return sandbox.sandboxId;
    });

    const existingFiles = await step.run("get-existing-files", async () => {
      const lastMessage = await prisma.message.findFirst({
        where: {
          projectId: event.data.projectId,
          fragment: { isNot: null },
        },
        include: { fragment: true },
        orderBy: { createdAt: "desc" },
      });

      if (lastMessage?.fragment?.files) {
        return lastMessage.fragment.files as Record<string, string>;
      }
      return null;
    });

    const previousMessages = await step.run("get-previous-messages", async () => {
      const formattedMessages: Message[] = [];

      const messages = await prisma.message.findMany({
        where: {
          projectId: event.data.projectId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      });

      for (const message of messages) {
        formattedMessages.push({
          type: "text",
          role: message.role === "ASSISTANT" ? "assistant" : "user",
          content: message.content,
        })
      }

      return formattedMessages.reverse();
    });

    const state = createState<AgentState>(
      {
        summary: "",
        files: existingFiles ?? {},
      },
      {
        messages: previousMessages,
      },
    );

    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: openai({
        model: codeModel,
        baseUrl: geminiBaseUrl,
        apiKey: geminiApiKey,
        defaultParameters: {
          temperature: 0.1,
        },
      }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = { stdout: "", stderr: "" };

              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  timeoutMs: 5 * 60 * 1000, // 5 minutes
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  }
                });
                return result.stdout;
              } catch (e) {
                console.error(
                  `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`,
                );
                return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
              }
            });
          },
        }),
        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              }),
            ),
          }),
          handler: async (
            { files },
            { step, network }: Tool.Options<AgentState>
          ) => {
            const newFiles = await step?.run("createOrUpdateFiles", async () => {
              try {
                const updatedFiles = network.state.data.files || {};
                const sandbox = await getSandbox(sandboxId);
                for (const file of files) {
                  await sandbox.files.write(file.path, file.content);
                  updatedFiles[file.path] = file.content;
                }

                return updatedFiles;
              } catch (e) {
                return "Error: " + e;
              }
            });

            if (typeof newFiles === "object") {
              network.state.data.files = newFiles;
            }
          }
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }, { step }) => {
            return await step?.run("readFiles", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const contents = [];
                for (const file of files) {
                  const content = await sandbox.files.read(file);
                  contents.push({ path: file, content });
                }
                return JSON.stringify(contents);
              } catch (e) {
                return "Error: " + e;
              }
            })
          },
        })
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText =
            lastAssistantTextMessageContent(result);

          if (lastAssistantMessageText && network) {
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText;
            }
          }

          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: async ({ network }) => {
        const summary = network.state.data.summary;

        if (summary) {
          return;
        }

        return codeAgent;
      },
    });

    let userPrompt = event.data.value;

    if (existingFiles) {
      const fileList = Object.keys(existingFiles).join(", ");
      userPrompt = `IMPORTANT: This is a follow-up request on an EXISTING project. The sandbox already contains working code. You MUST read the existing files first using readFiles, then modify only what is needed. Do NOT regenerate or rewrite the entire project from scratch.

Existing files in the sandbox: ${fileList}

User request: ${event.data.value}`;
    }

    const result = await network.run(userPrompt, { state });

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({
        model: titleModel,
        baseUrl: geminiBaseUrl,
        apiKey: geminiApiKey,
      }),
    })

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: openai({
        model: responseModel,
        baseUrl: geminiBaseUrl,
        apiKey: geminiApiKey,
      }),
    });

    const { 
      output: fragmentTitleOuput
    } = await fragmentTitleGenerator.run(result.state.data.summary);
    const { 
      output: responseOutput
    } = await responseGenerator.run(result.state.data.summary);

    const isError =
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run("save-result", async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again.",
            role: "ASSISTANT",
            type: "ERROR",
          },
        });
      }

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: parseAgentOutput(responseOutput),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: parseAgentOutput(fragmentTitleOuput),
              files: result.state.data.files,
            },
          },
        },
      })
    });

    return { 
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  },
);