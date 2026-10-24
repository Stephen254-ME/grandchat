import { NextResponse } from "next/server";

export const runtime = "edge"; // Low latency edge runtime for fast TTFT (Time-To-First-Token)

export async function POST(req: Request) {
  try {
    const { messages, model, persona } = await req.json();

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API Key is missing." },
        { status: 500 }
      );
    }

    // Forward client signal for cancellation
    const controller = new AbortController();
    req.signal.addEventListener("abort", () => controller.abort());

    const systemPrompt = persona
      ? `You are ${persona}. Provide clear, well-structured, high-quality responses.`
      : "You are a helpful, intelligent AI assistant.";

    const openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://grandchat.vercel.app",
          "X-Title": "GrandChat AI",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || "google/gemini-2.0-flash-001",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
        signal: controller.signal,
      }
    );

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      return NextResponse.json(
        { error: `Provider error: ${openRouterResponse.status}` },
        { status: openRouterResponse.status }
      );
    }

    // Stream back directly with unbuffered streaming headers
    return new Response(openRouterResponse.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      return new Response("Stream aborted", { status: 499 });
    }
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}