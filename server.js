const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const NASA_APOD_URL = "https://science.nasa.gov/wp-json/wp/v2/apod-basic";
const FIRST_APOD_DATE = "1995-06-16";
const STATIC_FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
};

function isValidApodDate(value, today = new Date().toISOString().slice(0, 10)) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const normalized = [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");

  return normalized === value && value >= FIRST_APOD_DATE && value <= today;
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function handleApod(requestUrl, response, fetchImpl) {
  const query = requestUrl.searchParams;
  if ([...query.keys()].some((key) => key !== "date") || query.getAll("date").length > 1) {
    sendJson(response, 400, { error: "Parametros de consulta invalidos." });
    return;
  }

  const date = query.get("date") === null
    ? new Date().toISOString().slice(0, 10)
    : query.get("date");
  if (!isValidApodDate(date)) {
    sendJson(response, 400, { error: "Informe uma data entre 1995-06-16 e hoje." });
    return;
  }

  const nasaDate = date.replace(/-/g, "").slice(2);
  const nasaUrl = new URL(`${NASA_APOD_URL}/${nasaDate}`);

  let nasaResponse;
  try {
    nasaResponse = await fetchImpl(nasaUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    sendJson(response, 502, { error: "Nao foi possivel consultar a API da NASA. Tente novamente." });
    return;
  }

  if (!nasaResponse.ok) {
    const messages = {
      400: "A NASA rejeitou a data ou os parametros enviados.",
      403: "A NASA recusou o acesso ao feed APOD.",
      404: "A NASA nao encontrou uma imagem para essa data.",
      429: "O limite de requisicoes da NASA foi atingido. Aguarde e tente novamente.",
    };
    const message = messages[nasaResponse.status] || "A API da NASA esta temporariamente indisponivel.";
    sendJson(response, 502, { error: `${message} (HTTP ${nasaResponse.status}).` });
    return;
  }

  let apod;
  try {
    apod = await nasaResponse.json();
  } catch {
    sendJson(response, 502, { error: "A API da NASA retornou uma resposta invalida." });
    return;
  }

  if (
    !apod ||
    typeof apod.title !== "string" ||
    typeof apod.explanation !== "string" ||
    !["image", "video"].includes(apod.media_type)
  ) {
    sendJson(response, 502, { error: "A API da NASA retornou dados incompletos ou invalidos." });
    return;
  }

  const imageUrl = apod.media_type === "image" ? extractImageUrl(apod.basic_html) : null;
  const apodUrl = apod.permalink || apod.url;
  if (
    apod.date !== date ||
    typeof apodUrl !== "string" ||
    !isHttpsUrl(apodUrl) ||
    (apod.media_type === "image" && !imageUrl)
  ) {
    sendJson(response, 502, { error: "A API da NASA retornou dados incompletos ou invalidos." });
    return;
  }

  const result = {
    date: apod.date,
    title: apod.title,
    explanation: apod.explanation,
    media_type: apod.media_type,
    url: apodUrl,
  };
  if (imageUrl) result.image_url = imageUrl;
  sendJson(response, 200, result);
}

function extractImageUrl(html) {
  if (typeof html !== "string") return null;

  const match = html.match(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const imageUrl = match && (match[1] || match[2] || match[3]);
  if (!imageUrl) return null;

  const decodedUrl = imageUrl.replace(/&amp;|&#0*38;/gi, "&");
  return isHttpsUrl(decodedUrl) ? decodedUrl : null;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function createServer({ fetchImpl = globalThis.fetch } = {}) {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://localhost");

    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET", "Content-Type": "text/plain; charset=utf-8" });
      response.end("Metodo nao permitido.");
      return;
    }

    if (requestUrl.pathname === "/api/apod") {
      await handleApod(requestUrl, response, fetchImpl);
      return;
    }

    const file = STATIC_FILES[requestUrl.pathname];
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Pagina nao encontrada.");
      return;
    }

    const filePath = path.join(__dirname, "public", file[0]);
    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Nao foi possivel carregar a pagina.");
        return;
      }

      response.writeHead(200, {
        "Content-Type": file[1],
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'self'; img-src 'self' https:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'self'",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      response.end(content);
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.listen(port, () => {
    console.log(`NASA APOD disponivel em http://localhost:${port}`);
  });
}

module.exports = { createServer, extractImageUrl, isValidApodDate };
