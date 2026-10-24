import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { messages, model, persona, userContext, temperature, responseLength } = await req.json();

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API Key is missing." },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    req.signal.addEventListener("abort", () => controller.abort());

    // Context Injection for Time, Date, Timezone & Verbosity
    const temporalContext = userContext 
      ? `\n\n[USER ENVIRONMENT & REAL-TIME CONTEXT]:
- Local Date & Time: ${userContext.dateTime}
- Timezone: ${userContext.timeZone}
- Day Period: ${userContext.timeOfDay}
Always greet and align temporal references accurately according to this local context.`
      : "";

    const lengthInstruction = responseLength === "concise"
      ? "\n\nProvide direct, succinct, high-density responses without fluff."
      : responseLength === "detailed"
      ? "\n\nProvide highly detailed, comprehensive, structured, and thorough explanations."
      : "";

    const systemPrompt = (persona || "You are a helpful AI assistant.") + temporalContext + lengthInstruction;

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
          temperature: typeof temperature === "number" ? temperature : 0.7,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
        signal: controller.signal,
      }
    );

    if (!openRouterResponse.ok) {
      return NextResponse.json(
        { error: `Provider error: ${openRouterResponse.status}` },
        { status: openRouterResponse.status }
      );
    }

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
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}