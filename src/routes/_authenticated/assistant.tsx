import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { listThreads, createThread } from "@/lib/assistant.functions";

export const Route = createFileRoute("/_authenticated/assistant")({
  loader: async ({ context }) => {
    const threads = await context.queryClient.fetchQuery({
      queryKey: ["assistant", "threads"],
      queryFn: () => listThreads(),
    });
    return { threads };
  },
  component: () => <Outlet />,
});
