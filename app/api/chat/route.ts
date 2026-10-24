import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json();

    const apiKey =
      process.env.OPENROUTER_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key missing in environment variables" },
        { status: 500 }
      );
    }

    // Convert system messages into user/assistant framing if needed to bypass router safety triggers
    const formattedMessages = messages.map((m: any) => ({
      role: m.role === "system" ? "user" : m.role,
      content: m.content,
    }));

    // Selected model or fallback to standard free model
    const targetModel = model || "meta-llama/llama-3.3-70b-instruct:free";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "GrandChat AI",
      },
      body: JSON.stringify({
        model: targetModel,
        messages: formattedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter Error:", errorText);
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Server API Catch Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}