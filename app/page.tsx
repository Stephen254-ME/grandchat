"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  MessageSquare, Plus, PanelLeftClose, PanelLeft, Sparkles, 
  Code, BookOpen, UserCheck, HelpCircle, Copy, Check, Trash2, Send, LogOut, Lock, Mail,
  Search, Compass, Feather, Download, ChevronDown, Cpu, Square, AlertCircle, RefreshCw, Edit2, X, Terminal, Sliders
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { User } from "@supabase/supabase-js";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
}

interface Persona {
  id: string;
  name: string;
  title: string;
  icon: React.ReactNode;
  systemPrompt: string;
}

const PERSONAS: Persona[] = [
  {
    id: "scholar",
    name: "Master Scholar",
    title: "Academic & Deep Analysis",
    icon: <BookOpen className="w-4 h-4 text-amber-400" />,
    systemPrompt: "You are the Master Scholar. Provide eloquent, highly detailed, precise, and academically structured responses.",
  },
  {
    id: "architect",
    name: "Code Architect",
    title: "Engineering & System Design",
    icon: <Code className="w-4 h-4 text-amber-400" />,
    systemPrompt: "You are the Vintage Code Architect. Provide clean, production-ready, modular code with concise explanations.",
  },
  {
    id: "mentor",
    name: "Philosophical Mentor",
    title: "Wisdom & Strategy",
    icon: <Compass className="w-4 h-4 text-amber-400" />,
    systemPrompt: "You are the Philosophical Mentor. Offer wise, measured, high-level strategic guidance and thoughtful insights.",
  },
  {
    id: "archivist",
    name: "Royal Archivist",
    title: "Historical & Storyteller",
    icon: <Feather className="w-4 h-4 text-amber-400" />,
    systemPrompt: "You are the Royal Archivist. Present information with elegance, literary charm, and historical perspective.",
  },
];

const MODELS = [
  { id: "openrouter/free", name: "Gemini 2.0 Flash (Free)" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (Free)" },
  { id: "mistralai/mistral-small-24b-instruct-2501:free", name: "Mistral Small (Free)" },
];

const SUGGESTED_PROMPTS = [
  { icon: Code, title: "Help with coding", prompt: "Write a Python script to sort a list using quicksort and explain how it works." },
  { icon: BookOpen, title: "English help", prompt: "Review my email for professional tone and grammar improvements." },
  { icon: UserCheck, title: "Interview practice", prompt: "Ask me a common behavioral interview question for a software engineering role." },
  { icon: HelpCircle, title: "General questions", prompt: "Explain quantum computing in simple terms for a beginner." },
];

function MarkdownRenderer({ content, onCopyCode, copiedCodeId }: { content: string; onCopyCode: (code: string, id: string) => void; copiedCodeId: string | null }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const firstLineEnd = part.indexOf("\n");
          const language = part.slice(3, firstLineEnd > -1 ? firstLineEnd : 3).trim() || "code";
          const codeText = firstLineEnd > -1 ? part.slice(firstLineEnd + 1, -3) : part.slice(3, -3);
          const blockId = `code-${index}`;

          return (
            <div key={index} className="my-3 rounded-xl border border-amber-500/20 bg-zinc-950/90 overflow-hidden shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-amber-900/30 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-mono text-amber-200/80 lowercase">{language}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onCopyCode(codeText, blockId)}
                  className="flex items-center gap-1 text-[11px] text-amber-400/80 hover:text-amber-300 transition"
                  aria-label="Copy code block"
                >
                  {copiedCodeId === blockId ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto font-mono text-xs text-amber-100/90 leading-normal">
                <code>{codeText}</code>
              </pre>
            </div>
          );
        }

        return (
          <div key={index} className="whitespace-pre-wrap">
            {part}
          </div>
        );
      })}
    </div>
  );
}

export default function ChatApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<Persona>(PERSONAS[0]);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [responseLength, setResponseLength] = useState<"concise" | "balanced" | "detailed">("balanced");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputMessage]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowExportModal(false);
      setShowSettingsModal(false);
      setDeletingChatId(null);
      setRenamingChatId(null);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setIsMounted(true);
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserChats();
    } else {
      setChats([]);
    }
  }, [user]);

  const fetchUserChats = async () => {
    if (!user) return;
    try {
      const { data: convs, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (convError) throw convError;

      if (convs && convs.length > 0) {
        const loadedChats: Chat[] = [];
        for (const conv of convs) {
          const { data: msgs } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: true });

          loadedChats.push({
            id: conv.id,
            title: conv.title,
            messages: msgs ? msgs.map((m: any) => ({ id: m.id, role: m.role as "user" | "assistant" | "system", content: m.content })) : []
          });
        }
        setChats(loadedChats);
        setActiveChatId(loadedChats[0].id);
      } else {
        createNewChat();
      }
    } catch (err) {
      console.error("Error fetching chats:", err);
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChatId, activeChat?.messages?.length, isTyping]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        alert("Check your email for confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    handleStopGeneration();
    await supabase.auth.signOut();
    setUser(null);
    setChats([]);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsTyping(false);
    }
  };

  const startRenaming = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingChatId(chat.id);
    setRenameInput(chat.title);
  };

  const saveRename = async (chatId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renameInput.trim()) {
      setRenamingChatId(null);
      return;
    }

    await supabase
      .from("conversations")
      .update({ title: renameInput.trim() })
      .eq("id", chatId);

    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: renameInput.trim() } : c));
    setRenamingChatId(null);
  };

  const confirmDeleteChat = async () => {
    if (!deletingChatId) return;
    handleStopGeneration();
    await supabase.from("conversations").delete().eq("id", deletingChatId);

    const filtered = chats.filter(c => c.id !== deletingChatId);
    setDeletingChatId(null);

    if (filtered.length === 0) {
      createNewChat();
    } else {
      setChats(filtered);
      if (activeChatId === deletingChatId) setActiveChatId(filtered[0].id);
    }
  };

  const getUserTimeContext = () => {
    const now = new Date();
    const hours = now.getHours();
    let timeOfDay = "morning";
    if (hours >= 12 && hours < 17) timeOfDay = "afternoon";
    else if (hours >= 17 && hours < 22) timeOfDay = "evening";
    else if (hours >= 22 || hours < 5) timeOfDay = "night";

    return {
      dateTime: now.toLocaleString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timeOfDay,
    };
  };

  const handleSendMessage = async (textToSend?: string, isRegenerating = false) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || !user || isTyping) return;

    setErrorBanner(null);
    if (!textToSend && !isRegenerating) setInputMessage("");

    let newMessagesList = [...(activeChat?.messages || [])];

    if (!isRegenerating) {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text
      };

      let currentChatId = activeChatId;
      let currentTitle = activeChat?.title || "New Conversation";
      const isFirstMessage = activeChat?.messages.length === 0;

      if (isFirstMessage) {
        currentTitle = text.slice(0, 30) + (text.length > 30 ? "..." : "");
        await supabase.from("conversations").upsert({
          id: currentChatId,
          user_id: user.id,
          title: currentTitle
        });
      }

      await supabase.from("messages").insert({
        id: userMsg.id,
        conversation_id: currentChatId,
        role: userMsg.role,
        content: userMsg.content
      });

      newMessagesList = [...newMessagesList, userMsg];

      setChats(prev => prev.map(chat => {
        if (chat.id === currentChatId) {
          return { ...chat, title: currentTitle, messages: newMessagesList };
        }
        return chat;
      }));
    }

    setIsTyping(true);

    const aiMsgId = (Date.now() + 1).toString();
    const initialAiMsg: Message = {
      id: aiMsgId,
      role: "assistant",
      content: ""
    };

    setChats(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
        return { ...chat, messages: [...newMessagesList, initialAiMsg] };
      }
      return chat;
    }));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const payloadMessages = newMessagesList.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: payloadMessages,
          model: selectedModel.id,
          persona: selectedPersona.systemPrompt,
          userContext: getUserTimeContext(),
          temperature,
          responseLength
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("Failed to generate AI response");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.replace("data: ", "").trim();
              if (dataStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataStr);
                const contentChunk = parsed.choices?.[0]?.delta?.content || "";
                if (contentChunk) {
                  accumulatedContent += contentChunk;

                  setChats(prev => prev.map(chat => {
                    if (chat.id === activeChatId) {
                      return {
                        ...chat,
                        messages: chat.messages.map(m => 
                          m.id === aiMsgId ? { ...m, content: accumulatedContent } : m
                        )
                      };
                    }
                    return chat;
                  }));
                }
              } catch (e) {
                // Ignore incomplete lines
              }
            }
          }
        }
      }

      if (accumulatedContent) {
        await supabase.from("messages").insert({
          id: aiMsgId,
          conversation_id: activeChatId,
          role: "assistant",
          content: accumulatedContent
        });
      }

    } catch (err: any) {
      if (err.name === "AbortError") {
        // Stream aborted gracefully
      } else {
        console.error("AI Streaming Error:", err);
        setErrorBanner("Connection lost or request timed out. Please try again.");
      }
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  };

  const handleRegenerateResponse = () => {
    const lastUserMsg = [...(activeChat?.messages || [])].reverse().find(m => m.role === "user");
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.content, true);
    }
  };

  const createNewChat = async () => {
    handleStopGeneration();
    if (!user) return;
    const newChatId = Date.now().toString();
    const newChat: Chat = {
      id: newChatId,
      title: "New Conversation",
      messages: []
    };

    await supabase.from("conversations").insert({
      id: newChatId,
      user_id: user.id,
      title: "New Conversation"
    });

    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
    setErrorBanner(null);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyCodeToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleExportMarkdown = () => {
    const transcript = activeChat.messages
      .filter(m => m.role !== "system")
      .map(m => `### ${m.role === "user" ? "User" : selectedPersona.name}\n\n${m.content}\n`)
      .join("\n---\n\n");

    const blob = new Blob([`# ${activeChat.title}\n\n${transcript}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeChat.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-manuscript.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const filteredChats = chats.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isMounted) {
    return (
      <div className="dark bg-zinc-950 text-amber-50 flex h-screen items-center justify-center font-sans">
        <div className="flex items-center gap-2 text-amber-400 text-sm animate-pulse">
          <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
          <span>Loading GrandChat...</span>
        </div>
      </div>
    );
  }

  // AUTH SCREEN
  if (!user) {
    return (
      <div className="dark bg-zinc-950 text-amber-50 flex h-screen items-center justify-center font-sans px-4">
        <div className="max-w-md w-full bg-zinc-900/80 border border-amber-900/40 p-8 rounded-2xl shadow-2xl backdrop-blur-md">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-100 via-amber-300 to-amber-200 bg-clip-text text-transparent">
              GrandChat AI
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {isSignUp ? "Create your Supabase account" : "Sign in to access your cloud chats"}
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-amber-200/80 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-amber-900/40 bg-zinc-950/60 py-3 pl-10 pr-4 text-sm text-amber-50 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-amber-200/80 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-amber-900/40 bg-zinc-950/60 py-3 pl-10 pr-4 text-sm text-amber-50 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-semibold hover:from-amber-400 hover:to-amber-500 transition shadow-md shadow-amber-950/40 disabled:opacity-50"
            >
              {authLoading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-amber-400 hover:underline"
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN CHAT APP VIEW
  return (
    <div className="dark bg-zinc-950 text-amber-50 flex h-screen overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <aside 
        className={`${sidebarOpen ? "w-64" : "w-0 -ml-64"} transition-all duration-300 flex flex-col border-r border-amber-900/30 bg-zinc-900/90 z-20 shrink-0 backdrop-blur-md`}
        aria-label="Conversation History"
      >
        <div className="p-3 flex items-center justify-between border-b border-amber-900/30">
          <button 
            type="button"
            onClick={createNewChat}
            className="flex-1 flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 px-3 py-2 rounded-lg text-sm font-semibold transition shadow-md shadow-amber-950/40"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
          <button 
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-2 p-2 text-amber-400/70 hover:text-amber-300 hover:bg-zinc-800/80 rounded-lg transition"
            title="Close Sidebar"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-amber-500/50" />
            <input
              type="text"
              placeholder="Search archives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950/60 border border-amber-900/30 rounded-lg pl-9 pr-3 py-2 text-xs text-amber-50 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredChats.map(chat => (
            <div
              key={chat.id}
              onClick={() => {
                if (renamingChatId !== chat.id) {
                  handleStopGeneration();
                  setActiveChatId(chat.id);
                  setErrorBanner(null);
                }
              }}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition border ${
                chat.id === activeChatId 
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-200 font-medium" 
                  : "border-transparent hover:bg-zinc-800/50 text-zinc-400 hover:text-amber-100"
              }`}
            >
              {renamingChatId === chat.id ? (
                <form 
                  onSubmit={(e) => saveRename(chat.id, e)} 
                  className="flex items-center gap-1 w-full"
                >
                  <input
                    type="text"
                    autoFocus
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-amber-500/50 rounded px-2 py-1 text-xs text-amber-50 focus:outline-none"
                  />
                  <button type="submit" className="text-amber-400 hover:text-amber-300 p-1">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setRenamingChatId(null)} 
                    className="text-zinc-500 hover:text-zinc-300 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-2 truncate flex-1">
                    <MessageSquare className={`w-4 h-4 shrink-0 ${chat.id === activeChatId ? "text-amber-400" : "text-zinc-500"}`} />
                    <span className="truncate">{chat.title}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      onClick={(e) => startRenaming(chat, e)}
                      className="p-1 text-zinc-500 hover:text-amber-400 rounded transition"
                      title="Rename chat"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingChatId(chat.id);
                      }}
                      className="p-1 text-zinc-500 hover:text-red-400 rounded transition"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-amber-900/30 flex items-center justify-between text-xs text-amber-500/70">
          <span className="truncate max-w-[140px]" title={user.email}>{user.email}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-400 transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
        
        {/* Header */}
        <header className="h-14 border-b border-amber-900/30 flex items-center justify-between px-4 shrink-0 bg-zinc-950/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button 
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-amber-400/70 hover:text-amber-300 hover:bg-zinc-800/80 rounded-lg transition"
                title="Open Sidebar"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            )}

            {/* Persona Selector */}
            <div className="relative group">
              <button className="flex items-center gap-2 bg-zinc-900/90 border border-amber-900/40 hover:border-amber-500/50 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-200 transition">
                {selectedPersona.icon}
                <span>{selectedPersona.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-amber-500/70" />
              </button>
              <div className="absolute top-full left-0 mt-1.5 w-52 bg-zinc-900 border border-amber-900/40 rounded-xl shadow-2xl p-1 hidden group-hover:block z-30">
                {PERSONAS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPersona(p)}
                    className={`w-full text-left p-2 rounded-lg flex items-center gap-2 text-xs transition ${
                      selectedPersona.id === p.id ? "bg-amber-950/40 text-amber-200" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    {p.icon}
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-[10px] text-zinc-500">{p.title}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Model Badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900/60 border border-amber-900/30 px-2.5 py-1 rounded-lg text-[11px] text-amber-200/80">
              <Cpu className="w-3.5 h-3.5 text-amber-500" />
              <span>{selectedModel.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="p-2 text-zinc-400 hover:text-amber-300 border border-amber-900/30 hover:border-amber-500/40 rounded-lg transition"
              title="Scribe Parameters"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 text-xs text-amber-400/80 hover:text-amber-300 border border-amber-900/30 hover:border-amber-500/40 px-3 py-1.5 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Manuscript</span>
            </button>
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {activeChat?.messages.filter(m => m.role !== "system").length === 0 ? (
            <div className="max-w-2xl mx-auto h-full flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-950/50">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-3xl font-extrabold mb-2 bg-gradient-to-r from-amber-100 via-amber-300 to-amber-200 bg-clip-text text-transparent">
                How can I assist you today?
              </h2>
              <p className="text-zinc-400 text-sm mb-8 max-w-md">
                Select a gold starter prompt below or type your question to get started.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {SUGGESTED_PROMPTS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(item.prompt)}
                      className="p-4 rounded-xl border border-amber-900/30 hover:border-amber-500/60 bg-zinc-900/40 hover:bg-amber-950/20 text-left transition flex flex-col gap-2 group shadow-sm hover:-translate-y-0.5 transition-transform"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-zinc-950 transition">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-amber-100 group-hover:text-amber-300 transition">{item.title}</span>
                      <span className="text-xs text-zinc-400 line-clamp-1">{item.prompt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {activeChat?.messages.filter(m => m.role !== "system").map((msg, idx, arr) => (
                <div 
                  key={msg.id} 
                  className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-zinc-950 flex items-center justify-center shrink-0 text-xs font-bold shadow-md shadow-amber-950/50">
                      AI
                    </div>
                  )}

                  {msg.content === "" && msg.role === "assistant" && isTyping ? (
                    /* Borderless Shimmering Loading Line (No Box Artifact) */
                    <div className="flex items-center space-x-2 py-2 text-amber-400/90 text-xs font-medium">
                      <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                      <span className="animate-pulse">Scribe is contemplating...</span>
                    </div>
                  ) : (
                    <div className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-medium shadow-md shadow-amber-950/30"
                        : "bg-zinc-900/90 text-amber-50 border border-amber-900/40 shadow-md"
                    }`}>
                      <MarkdownRenderer content={msg.content} onCopyCode={copyCodeToClipboard} copiedCodeId={copiedCodeId} />
                      
                      {msg.role === "assistant" && msg.content && (
                        <div className="absolute right-2 -bottom-3 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 bg-zinc-900 border border-amber-900/50 rounded-md shadow-lg px-2 py-0.5">
                          <button 
                            type="button"
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="text-amber-400/80 hover:text-amber-300 flex items-center gap-1 text-xs"
                          >
                            {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                          </button>
                          {idx === arr.length - 1 && !isTyping && (
                            <button
                              type="button"
                              onClick={handleRegenerateResponse}
                              className="text-amber-400/80 hover:text-amber-300 flex items-center gap-1 text-xs pl-1 border-l border-zinc-700"
                              title="Regenerate Response"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Retry</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-amber-900/40 text-amber-300 flex items-center justify-center shrink-0 text-xs font-bold">
                      U
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Retry Banner */}
        {errorBanner && (
          <div className="max-w-2xl mx-auto mb-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-amber-400 text-xs mx-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={handleRegenerateResponse}
              className="flex items-center space-x-1 font-semibold hover:underline"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Floating Command Composer Bar */}
        <div className="p-4 border-t border-amber-900/30 bg-zinc-950/80 shrink-0 backdrop-blur-md">
          <div className="max-w-3xl mx-auto relative shadow-[0_0_20px_rgba(245,158,11,0.06)] rounded-xl">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" && !e.shiftKey) || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Ask ${selectedPersona.name} anything... (Press Enter to send)`}
              className="w-full resize-none rounded-xl border border-amber-900/40 bg-zinc-900/90 px-4 py-3 pr-12 text-sm text-amber-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 transition shadow-inner overflow-y-auto max-h-44"
            />
            {isTyping ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="absolute right-3 bottom-3 p-2 rounded-lg bg-zinc-800 text-amber-400 hover:bg-zinc-700 transition shadow-md"
                title="Stop Generating"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim()}
                className="absolute right-3 bottom-3 p-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-30 disabled:hover:from-amber-500 disabled:hover:to-amber-600 transition shadow-md shadow-amber-950/40"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-center text-[11px] text-zinc-500 mt-2">
            GrandChat By Mugisha
          </p>
        </div>

      </main>

      {/* Delete Confirmation Modal */}
      {deletingChatId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-amber-900/50 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-semibold text-base text-amber-200">Delete Conversation?</h3>
            <p className="text-xs text-zinc-400">
              Are you sure you want to delete this chat session? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingChatId(null)}
                className="px-4 py-2 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteChat}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs shadow-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scribe Parameters Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-amber-900/50 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-amber-900/30 pb-3">
              <div className="flex items-center gap-2 text-amber-200 font-semibold text-sm">
                <Sliders className="w-4 h-4 text-amber-500" />
                <span>Scribe Execution Parameters</span>
              </div>
              <button type="button" onClick={() => setShowSettingsModal(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Creativity (Temperature): <span className="text-amber-400">{temperature}</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                  <span>Precise / Fact-based (0.1)</span>
                  <span>Creative (1.0)</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-300 mb-1">Verbosity / Response Length</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(["concise", "balanced", "detailed"] as const).map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setResponseLength(len)}
                      className={`py-2 rounded-lg border text-xs capitalize transition ${
                        responseLength === len
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold"
                          : "border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-amber-900/30">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parchment Manuscript Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-amber-900/50 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-amber-900/30 pb-3">
              <h3 className="font-serif font-bold text-lg text-amber-200">
                Archival Manuscript Export
              </h3>
              <button type="button" onClick={() => setShowExportModal(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>
            <p className="text-xs text-zinc-400">
              Download your current conversation transcript formatted as an archival markdown manuscript (`.md`).
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowExportModal(false)} className="px-4 py-2 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportMarkdown}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 text-zinc-950 font-semibold text-xs shadow-md hover:brightness-110"
              >
                Download Manuscript (.md)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}