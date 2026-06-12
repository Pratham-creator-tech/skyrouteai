import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, MessageSquare, Sparkles, BrainCircuit, Bot,
  TrendingDown, AlertTriangle, Truck, Leaf,
} from "lucide-react";
import {
  Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput, PromptInputTextarea, PromptInputSubmit, PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  listThreads, createThread, deleteThread, renameThread, getThreadMessages,
} from "@/lib/assistant.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistant/$threadId")({
  loader: async ({ params, context }) => {
    const [threads, initial] = await Promise.all([
      context.queryClient.fetchQuery({
        queryKey: ["assistant", "threads"],
        queryFn: () => listThreads(),
      }),
      getThreadMessages({ data: { threadId: params.threadId } }),
    ]);
    return { threads, initialMessages: initial.messages as UIMessage[] };
  },
  component: AssistantPage,
});

const SUGGESTIONS = [
  { icon: TrendingDown, label: "Which route is the cheapest right now?" },
  { icon: AlertTriangle, label: "What deliveries are at risk or delayed?" },
  { icon: Truck, label: "Which vehicle is overloaded or under-utilised?" },
  { icon: Leaf, label: "How can we reduce fuel costs and CO₂ this week?" },
];

function AssistantPage() {
  const { threadId } = Route.useParams();
  const { initialMessages } = Route.useLoaderData();
  const navigate = useNavigate();
  
  const qc = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const threadsQ = useQuery({
    queryKey: ["assistant", "threads"],
    queryFn: () => listThreads(),
  });
  const threads = threadsQ.data ?? [];

  const [authHeader, setAuthHeader] = useState<string | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthHeader(data.session ? `Bearer ${data.session.access_token}` : undefined);
    });
  }, [threadId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => (authHeader ? { Authorization: authHeader } : ({} as Record<string, string>)),
        body: { threadId },
      }),
    [authHeader, threadId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message || "Assistant error"),
    onFinish: () => qc.invalidateQueries({ queryKey: ["assistant", "threads"] }),
  });

  const isBusy = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;

  // Focus the textarea on mount + thread switch + after send.
  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, isBusy]);

  async function handleNewThread() {
    const t = await createThread({ data: {} });
    if (!t) return;
    qc.invalidateQueries({ queryKey: ["assistant", "threads"] });
    navigate({ to: "/assistant/$threadId", params: { threadId: t.id } });
  }

  async function handleDelete(id: string) {
    await deleteThread({ data: { id } });
    const next = await listThreads();
    qc.setQueryData(["assistant", "threads"], next);
    if (id === threadId) {
      const remaining = next[0];
      if (remaining) navigate({ to: "/assistant/$threadId", params: { threadId: remaining.id } });
      else navigate({ to: "/assistant" });
    }
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || isBusy) return;
    sendMessage({ text: t });
    // After first message in a new thread, give it a title from the prompt.
    const thread = threads.find((x) => x.id === threadId);
    if (thread && (thread.title === "New conversation" || !thread.title)) {
      const title = t.slice(0, 60) + (t.length > 60 ? "…" : "");
      renameThread({ data: { id: threadId, title } }).then(() =>
        qc.invalidateQueries({ queryKey: ["assistant", "threads"] }),
      );
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-background">
      {/* Thread sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/40 md:flex">
        <div className="flex items-center justify-between border-b px-3 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BrainCircuit className="h-4 w-4 text-primary" /> Conversations
          </div>
          <Button size="icon-sm" variant="ghost" onClick={handleNewThread} title="New chat">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 p-2">
            {threads.map((t) => {
              const active = t.id === threadId;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-2 text-sm",
                    active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                  )}
                >
                  <Link
                    to="/assistant/$threadId"
                    params={{ threadId: t.id }}
                    className="flex flex-1 items-center gap-2 truncate"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{t.title || "Untitled"}</span>
                  </Link>
                  <button
                    type="button"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(t.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              );
            })}
            {threads.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No conversations yet.
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main chat */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">SkyRoute Assistant</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Grounded on live logistics data
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleNewThread}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New
          </Button>
        </header>

        <Conversation>
          <ConversationContent className="mx-auto w-full max-w-3xl">
            {isEmpty ? (
              <ConversationEmptyState
                icon={<Sparkles className="h-8 w-8 text-primary" />}
                title="Ask SkyRoute anything about your fleet"
                description="The assistant reads live deliveries, vehicles, routes, warehouses and recent AI agent decisions to answer."
              >
                <Sparkles className="h-10 w-10 text-primary" />
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">Ask SkyRoute anything about your fleet</h3>
                  <p className="text-sm text-muted-foreground">
                    Grounded in live deliveries, vehicles, routes and agent decisions.
                  </p>
                </div>
                <div className="mt-4 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => send(s.label)}
                      className="flex items-start gap-2 rounded-lg border bg-card p-3 text-left text-sm transition-colors hover:border-primary hover:bg-accent/40"
                    >
                      <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </ConversationEmptyState>
            ) : (
              messages.map((m) => (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    {m.parts.map((part, i) => {
                      if (part.type === "text") {
                        if (m.role === "assistant") {
                          return <MessageResponse key={i}>{part.text}</MessageResponse>;
                        }
                        return (
                          <div key={i} className="whitespace-pre-wrap">
                            {part.text}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))
            )}
            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer>Analyzing fleet data…</Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t bg-background/80 px-4 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl">
            <PromptInput
              onSubmit={(payload) => {
                send(payload.text ?? "");
              }}
            >
              <PromptInputTextarea
                ref={textareaRef}
                placeholder="Ask about routes, vehicles, costs, delays, emissions…"
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={status} disabled={isBusy && status !== "streaming"} />
              </PromptInputFooter>
            </PromptInput>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              Answers are grounded in your live logistics database.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
