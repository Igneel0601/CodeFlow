import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Sandbox } from "@e2b/code-interpreter";

import { prisma } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { consumeCredits } from "@/lib/usage";
import { SANDBOX_TIMEOUT } from "@/inngest/types";

export const messagesRouter = createTRPCRouter({
  getMany: protectedProcedure
  .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ input, ctx }) => {
      const messages = await prisma.message.findMany({
        where: {
          projectId: input.projectId,
          project: {
            userId: ctx.auth.userId,
          },
        },
        include: {
          fragment: true,
        },
        orderBy: {
          updatedAt: "asc",
        },
      });

      return messages;
    }),
  create: protectedProcedure
    .input(
      z.object({
        value: z.string()
          .min(1, { message: "Value is required" })
          .max(10000, { message: "Value is too long" }),
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existingProject = await prisma.project.findUnique({
        where: {
          id: input.projectId,
          userId: ctx.auth.userId,
        },
      });

      if (!existingProject) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      try {
        await consumeCredits();
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Something went wrong" });
        } else {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You have run out of credits"
          });
        }
      }

      const createdMessage = await prisma.message.create({
        data: {
          projectId: existingProject.id,
          content: input.value,
          role: "USER",
          type: "RESULT",
        },
      });

      await inngest.send({
        name: "code-agent/run",
        data: {
          value: input.value,
          projectId: input.projectId,
        },
      });

      return createdMessage;
    }),
  cancel: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existingProject = await prisma.project.findUnique({
        where: {
          id: input.projectId,
          userId: ctx.auth.userId,
        },
      });

      if (!existingProject) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      await inngest.send({
        name: "code-agent/cancel",
        data: {
          projectId: input.projectId,
        },
      });

      await prisma.message.create({
        data: {
          projectId: input.projectId,
          content: "Generation was stopped.",
          role: "ASSISTANT",
          type: "ERROR",
        },
      });

      return { success: true };
    }),
  revive: protectedProcedure
    .input(
      z.object({
        fragmentId: z.string().min(1, { message: "Fragment ID is required" }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const fragment = await prisma.fragment.findUnique({
        where: { id: input.fragmentId },
        include: {
          message: {
            include: {
              project: true,
            },
          },
        },
      });

      if (!fragment || fragment.message.project.userId !== ctx.auth.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fragment not found" });
      }

      const sandbox = await Sandbox.create("codeflow");
      await sandbox.setTimeout(SANDBOX_TIMEOUT);

      const files = fragment.files as Record<string, string>;
      for (const [path, content] of Object.entries(files)) {
        await sandbox.files.write(path, content);
      }

      const host = sandbox.getHost(3000);
      const sandboxUrl = `https://${host}`;

      await prisma.fragment.update({
        where: { id: fragment.id },
        data: { sandboxUrl },
      });

      await prisma.project.update({
        where: { id: fragment.message.project.id },
        data: { sandboxId: sandbox.sandboxId },
      });

      return { sandboxUrl };
    }),
});
