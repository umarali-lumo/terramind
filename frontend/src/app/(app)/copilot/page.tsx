"use client";

/** AI Copilot — chat grounded in live farm data. */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, Send, Sparkles, User } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useFarm } from "@/lib/farm";
import { relativeTime } from "@/lib/format";
import type {
  CopilotChatResponse,
  CopilotConversation,
  CopilotConversationSummary,
  CopilotDataSource,
  CopilotMessage,
} from "@/lib/types";

const DEFAULT_SUGGESTIONS = [
  "Which field needs attention today?",
  "How much water does my farm need?",
  "What's the disease risk this week?",
  "How is my yield looking?",
];

/** Render copilot replies: paragraphs, **bold** and "- " bullets. */
function ReplyText({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);
  return (
    <div className="tm-prose space-y-3 text-sm leading-relaxed">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const bullets = lines.filter((l) => l.trim().startsWith("- "));
        if (bullets.length > 0 && bullets.length === lines.length) {
          return (
            <ul key={bi} className="space-y-1.5">
              {bullets.map((line, li) => (
                <li key={li} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sprout-400" />
                  <span dangerouslySetInnerHTML={{ __html: inlineBold(line.trim().slice(2)) }} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={bi}
            dangerouslySetInnerHTML={{ __html: inlineBold(block) }}
          />
        );
      })}
    </div>
  );
}

function inlineBold(text: string): string {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function SourceChips({ sources }: { sources: CopilotDataSource[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {sources.map((s, i) => (
        <span
          key={i}
          className="rounded-full bg-canopy-900/80 px-2 py-0.5 text-[10px] font-medium text-moss-400 ring-1 ring-canopy-700"
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: CopilotMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          isUser
            ? "bg-canopy-700 text-moss-300"
            : "bg-gradient-to-br from-sprout-500 to-sprout-700 text-canopy-950"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </span>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-sprout-600/20 text-moss-100 ring-1 ring-sprout-500/25"
            : "bg-canopy-850/90 text-moss-100 ring-1 ring-canopy-600/50"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </p>
        ) : (
          <ReplyText content={message.content} />
        )}
        {isUser ? null : <SourceChips sources={message.data_sources} />}
      </div>
    </div>
  );
}

export default function CopilotPage() {
  const { farmId } = useFarm();
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [localMessages, setLocalMessages] = useState<CopilotMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversationList } = useQuery({
    queryKey: ["copilot-conversations"],
    queryFn: () =>
      api<{ conversations: CopilotConversationSummary[] }>(
        "/api/v1/copilot/conversations",
      ),
  });

  const { data: conversation, isLoading: loadingConv } = useQuery({
    queryKey: ["copilot-conversation", activeId],
    queryFn: () =>
      api<CopilotConversation>(`/api/v1/copilot/conversations/${activeId}`),
    enabled: activeId !== null,
  });

  const chat = useMutation({
    mutationFn: (message: string) =>
      api<CopilotChatResponse>("/api/v1/copilot/chat", {
        method: "POST",
        body: {
          message,
          conversation_id: activeId,
          farm_id: farmId,
        },
      }),
    onSuccess: (res) => {
      setActiveId(res.conversation_id);
      setSuggestions(res.suggested_questions?.length ? res.suggested_questions : DEFAULT_SUGGESTIONS);
      setLocalMessages([]);
      queryClient.invalidateQueries({ queryKey: ["copilot-conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["copilot-conversation", res.conversation_id],
      });
    },
  });

  // Merge optimistic user message with loaded history.
  const messages: CopilotMessage[] = [
    ...(conversation?.messages ?? []),
    ...(chat.isPending && chat.variables
      ? [
          {
            id: -1,
            role: "user" as const,
            content: chat.variables,
            data_sources: [],
            created_at: new Date().toISOString(),
          },
        ]
      : []),
    ...localMessages,
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, chat.isPending]);

  function send(message: string) {
    const text = message.trim();
    if (!text || chat.isPending) return;
    setInput("");
    chat.mutate(text);
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col space-y-4">
      <PageHeader
        title="AI Copilot"
        description="Ask anything about your farm — answers are grounded in live field, weather and alert data."
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setActiveId(null);
              setLocalMessages([]);
              setSuggestions(DEFAULT_SUGGESTIONS);
            }}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New chat
          </Button>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Conversation list */}
        <Card padded={false} className="hidden flex-col lg:flex">
          <p className="border-b border-canopy-700/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-moss-500">
            Conversations
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {(conversationList?.conversations ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-moss-500">
                No conversations yet.
              </p>
            ) : (
              <ul className="divide-y divide-canopy-700/40">
                {(conversationList?.conversations ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        setActiveId(c.id);
                        setLocalMessages([]);
                      }}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-canopy-700/40 ${
                        activeId === c.id ? "bg-canopy-700/40" : ""
                      }`}
                    >
                      <p className="truncate text-xs font-medium text-moss-100">
                        {c.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-moss-500">
                        {c.message_count} messages · {relativeTime(c.updated_at)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Chat area */}
        <Card padded={false} className="flex min-h-0 flex-col">
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5"
          >
            {messages.length === 0 && !chat.isPending ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sprout-500 to-sprout-700 text-canopy-950 shadow-[0_8px_30px_-6px_rgba(52,208,113,0.5)]">
                  <Sparkles className="h-7 w-7" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-moss-50">
                  TerraMind Copilot
                </h2>
                <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-moss-400">
                  Every answer is computed from your farm&apos;s live data —
                  health scores, weather, disease risk and alerts.
                </p>
                <div className="mt-6 flex max-w-md flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-canopy-600/60 bg-canopy-900/60 px-3.5 py-2 text-xs text-moss-200 transition-colors hover:border-sprout-500/40 hover:text-sprout-300"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {chat.isPending ? (
                  <div className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sprout-500 to-sprout-700 text-canopy-950">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div className="flex items-center gap-1.5 rounded-2xl bg-canopy-850/90 px-4 py-3.5 ring-1 ring-canopy-600/50">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-2 w-2 rounded-full" />
                    </div>
                  </div>
                ) : null}
                {chat.isError ? (
                  <div className="rounded-xl border border-blaze-400/30 bg-blaze-400/10 px-4 py-2.5 text-xs text-blaze-300">
                    {(chat.error as Error).message}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-canopy-700/60 p-4">
            {messages.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {suggestions.slice(0, 3).map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-canopy-600/60 bg-canopy-900/60 px-3 py-1.5 text-[11px] text-moss-300 transition-colors hover:border-sprout-500/40 hover:text-sprout-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about irrigation, disease, yield, weather…"
                className="h-11 flex-1 rounded-xl border border-canopy-600/70 bg-canopy-900/70 px-4 text-sm text-moss-100 placeholder:text-moss-500 focus:border-sprout-500 focus:outline-none focus:ring-2 focus:ring-sprout-500/20"
              />
              <Button
                type="submit"
                loading={chat.isPending}
                disabled={!input.trim()}
                className="w-11 !px-0"
                aria-label="Send"
              >
                {!chat.isPending ? <Send className="h-4 w-4" /> : null}
              </Button>
            </form>
            <p className="mt-2 flex items-center gap-2 text-[10px] text-moss-500">
              <Badge tone="earth">
                {chat.data?.provider === "openai"
                  ? "LLM + farm data"
                  : "Farm-data engine"}
              </Badge>
              Answers reference live field intelligence — always verify
              critical decisions on the ground.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
