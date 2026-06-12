import { createFileRoute, redirect } from "@tanstack/react-router";
import { listThreads, createThread } from "@/lib/assistant.functions";

export const Route = createFileRoute("/_authenticated/assistant/")({
  loader: async () => {
    const threads = await listThreads();
    const first = threads[0];
    if (first) throw redirect({ to: "/assistant/$threadId", params: { threadId: first.id } });
    const created = await createThread({ data: {} });
    throw redirect({ to: "/assistant/$threadId", params: { threadId: created!.id } });
  },
  component: () => null,
});
