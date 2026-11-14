const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createServer, isValidApodDate } = require("../server");

const apodFixture = {
  date: "2024-01-01",
  title: "Uma galáxia espiral",
  explanation: "<strong>Explicacao:</strong> Uma galáxia distante.",
  media_type: "image",
  permalink: "https://science.nasa.gov/image-article/apod-2024-january-1/",
  hdurl: "https://science.nasa.gov/nasa-logo.png",
  basic_html: '<html><body><a href="https://assets.nasa.gov/galaxy.jpg"><IMG SRC="https://assets.nasa.gov/galaxy.jpg" alt="Galaxy"></a></body></html>',
};

async function startServer(options) {
  const server = createServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    fetch: (pathname) => globalThis.fetch(`http://127.0.0.1:${address.port}${pathname}`),
  };
}

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("validates APOD date range and rejects impossible dates", () => {
  assert.equal(isValidApodDate("1995-06-16", "2024-01-01"), true);
  assert.equal(isValidApodDate("2024-02-29", "2024-12-31"), true);
  assert.equal(isValidApodDate("2023-02-29", "2024-12-31"), false);
  assert.equal(isValidApodDate("1995-06-15", "2024-01-01"), false);
  assert.equal(isValidApodDate("2024-01-02", "2024-01-01"), false);
  assert.equal(isValidApodDate("2024-1-01", "2024-12-31"), false);
});

test("requests the APOD endpoint for the selected date and extracts its embedded image", async (t) => {
  let requestedUrl;
  const app = await startServer({
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return new Response(JSON.stringify(apodFixture), { status: 200 });
    },
  });
  t.after(() => stopServer(app.server));

  const response = await app.fetch("/api/apod?date=2024-01-01");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    date: apodFixture.date,
    title: apodFixture.title,
    explanation: apodFixture.explanation,
    media_type: apodFixture.media_type,
    url: apodFixture.permalink,
    image_url: "https://assets.nasa.gov/galaxy.jpg",
  });
  assert.equal(
    requestedUrl.origin + requestedUrl.pathname,
    "https://science.nasa.gov/wp-json/wp/v2/apod-basic/240101",
  );
  assert.equal(requestedUrl.search, "");
});

test("rejects invalid dates before making an upstream request", async (t) => {
  let fetchCalled = false;
  const app = await startServer({
    fetchImpl: async () => {
      fetchCalled = true;
      return new Response(JSON.stringify(apodFixture));
    },
  });
  t.after(() => stopServer(app.server));

  const response = await app.fetch("/api/apod?date=2024-02-30");
  assert.equal(response.status, 400);
  assert.equal(fetchCalled, false);
});

test("fetches APOD without requiring an API key", async (t) => {
  let fetchCalled = false;
  const app = await startServer({
    fetchImpl: async () => {
      fetchCalled = true;
      return new Response(JSON.stringify(apodFixture));
    },
  });
  t.after(() => stopServer(app.server));

  const response = await app.fetch("/api/apod?date=2024-01-01");
  assert.equal(response.status, 200);
  assert.equal(fetchCalled, true);
});

test("serves the app and rejects paths outside the static allowlist", async (t) => {
  const app = await startServer();
  t.after(() => stopServer(app.server));

  const page = await app.fetch("/");
  const pageText = await page.text();
  assert.equal(page.status, 200);
  assert.match(pageText, /NASA APOD/);
  assert.equal(page.headers.get("content-security-policy").includes("default-src 'self'"), true);
  assert.equal(pageText.includes("test-secret"), false);

  const unknown = await app.fetch("/..%2F.env");
  assert.equal(unknown.status, 404);
});

test("does not mistake the APOD page thumbnail for its embedded image", async (t) => {
  const apodWithoutImage = { ...apodFixture, basic_html: "<html><body>No image</body></html>" };
  const app = await startServer({
    fetchImpl: async () => new Response(JSON.stringify(apodWithoutImage)),
  });
  t.after(() => stopServer(app.server));

  const response = await app.fetch("/api/apod?date=2024-01-01");
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.match(body.error, /dados incompletos/);
});

for (const [status, expectedMessage] of [
  [403, /recusou o acesso/i],
  [429, /limite de requisicoes/i],
]) {
  test(`explains NASA HTTP ${status} errors without exposing response content`, async (t) => {
    const app = await startServer({
      fetchImpl: async () => new Response("test-secret", { status }),
    });
    t.after(() => stopServer(app.server));

    const response = await app.fetch("/api/apod?date=2024-01-01");
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.match(body.error, expectedMessage);
    assert.match(body.error, new RegExp(`HTTP ${status}`));
    assert.equal(body.error.includes("test-secret"), false);
  });
}

test("returns a clear gateway error for a malformed NASA response", async (t) => {
  const app = await startServer({
    fetchImpl: async () => new Response("{invalid json"),
  });
  t.after(() => stopServer(app.server));

  const response = await app.fetch("/api/apod?date=2024-01-01");
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.match(body.error, /resposta invalida/);
});
