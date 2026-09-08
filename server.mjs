import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./public", import.meta.url));
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("요청이 너무 큽니다.");
  }
  return JSON.parse(body || "{}");
}

async function generate(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    return json(res, 503, { error: "OPENAI_API_KEY가 설정되지 않았습니다.", code: "NO_API_KEY" });
  }

  try {
    const { prompt } = await readBody(req);
    if (!prompt?.trim()) return json(res, 400, { error: "작성할 내용이 없습니다." });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        store: false,
        instructions: "당신은 한국어 네이버 블로그 편집자다. 제공된 사실만 사용하고, 자연스럽고 구체적인 원고를 작성한다.",
        input: prompt
      })
    });

    const data = await response.json();
    if (!response.ok) return json(res, response.status, { error: data.error?.message || "AI 생성에 실패했습니다." });

    const text = data.output_text || data.output
      ?.flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text)
      .join("\n") || "";
    return json(res, 200, { text });
  } catch (error) {
    return json(res, 500, { error: error.message || "서버 오류가 발생했습니다." });
  }
}

async function generateImage(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    return json(res, 503, { error: "이미지 생성에는 OPENAI_API_KEY가 필요합니다.", code: "NO_API_KEY" });
  }
  try {
    const { prompt } = await readBody(req);
    if (!prompt?.trim()) return json(res, 400, { error: "이미지 설명을 입력해 주세요." });
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        prompt,
        size: "1024x1536",
        quality: "medium",
        output_format: "png"
      })
    });
    const data = await response.json();
    if (!response.ok) return json(res, response.status, { error: data.error?.message || "이미지 생성에 실패했습니다." });
    const image = data.data?.[0]?.b64_json;
    if (!image) return json(res, 500, { error: "생성된 이미지 데이터가 없습니다." });
    return json(res, 200, { image: `data:image/png;base64,${image}` });
  } catch (error) {
    return json(res, 500, { error: error.message || "이미지 생성 중 오류가 발생했습니다." });
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/generate") return generate(req, res);
  if (req.method === "POST" && req.url === "/api/generate-image") return generateImage(req, res);

  const pathname = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403); return res.end("Forbidden");
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "content-type": types[extname(filePath)] || "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("페이지를 찾을 수 없습니다.");
  }
});

server.listen(port, () => console.log(`Nixie Blog Studio: http://localhost:${port}`));
