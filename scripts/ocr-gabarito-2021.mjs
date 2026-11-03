/**
 * Extrai gabarito 2021 (PDF imagem) via Gemini e grava tmp-tjsp-provas/gab-2021-keys.json
 * Não imprime a API key.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const env = Object.fromEntries(
  readFileSync(resolve(".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const apiKey = env.GEMINI_API_KEY;
const model = env.GEMINI_MODEL || "gemini-2.0-flash";
if (!apiKey) {
  console.error("GEMINI_API_KEY ausente");
  process.exit(1);
}

const pdfPath = "C:/Users/xuniim/Downloads/Provas tjsp/2021/gabarito2021.pdf";
const b64 = readFileSync(pdfPath).toString("base64");
const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Este PDF é o gabarito oficial da prova TJSP Escrevente. Extraia TODAS as respostas no formato JSON estrito:
{"answers":{"1":"A","2":"B",...}}
Use apenas letras A-E. Sem markdown.`,
          },
          { inlineData: { mimeType: "application/pdf", data: b64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  }),
});

const data = await res.json();
if (!res.ok) {
  console.error("Gemini erro", res.status, data?.error?.message ?? data);
  process.exit(1);
}
const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
writeFileSync("tmp-tjsp-provas/gab-2021-raw.txt", text, "utf8");
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  console.error("Sem JSON na resposta");
  process.exit(1);
}
const parsed = JSON.parse(jsonMatch[0]);
const answers = parsed.answers ?? parsed;
mkdirSync("tmp-tjsp-provas", { recursive: true });
writeFileSync("tmp-tjsp-provas/gab-2021-keys.json", JSON.stringify(answers, null, 2));
console.log("keys", Object.keys(answers).length);
console.log("sample", Object.entries(answers).slice(0, 5));
