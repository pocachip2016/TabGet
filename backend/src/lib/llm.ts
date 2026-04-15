import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

type LLMProvider = "openai" | "ollama" | "gemini";

function getProvider(): LLMProvider {
  const raw = process.env.LLM_PROVIDER ?? "ollama";
  if (raw === "openai" || raw === "ollama" || raw === "gemini") return raw;
  throw new Error(
    `Unknown LLM_PROVIDER="${raw}". Must be "openai" | "ollama" | "gemini".`
  );
}

export function createLLM(temperature: number): BaseChatModel {
  const provider = getProvider();

  switch (provider) {
    case "ollama":
      return new ChatOllama({
        model: process.env.OLLAMA_MODEL ?? "qwen2.5:7b",
        baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        temperature,
      });

    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
      }
      return new ChatGoogleGenerativeAI({
        model: "gemini-2.0-flash",
        apiKey,
        temperature,
      });
    }

    default: // "openai"
      return new ChatOpenAI({ model: "gpt-4o", temperature });
  }
}
