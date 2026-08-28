import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { emailFromEnvironment, InfraiError } from "./infrai_email.js";
import { MediaSignupFlow } from "./verification_flow.js";

const signupBody = z.object({
  creatorEmail: z.string().email(),
  title: z.string().min(1).max(120),
  sourceName: z.string().min(1).max(240),
}).strict();

const port = Number(process.env.PORT ?? 3000);
const publicUrl = process.env.PUBLIC_URL ?? `http://localhost:${port}`;
const flow = new MediaSignupFlow(emailFromEnvironment(), publicUrl);

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", publicUrl);
    if (request.method === "POST" && url.pathname === "/signup") {
      const parsed = signupBody.safeParse(await readJson(request));
      if (!parsed.success) return json(response, 400, { error: "invalid_request", issues: parsed.error.issues });
      return json(response, 202, await flow.register({
        creatorEmail: parsed.data.creatorEmail!,
        title: parsed.data.title!,
        sourceName: parsed.data.sourceName!,
      }));
    }
    if (request.method === "GET" && url.pathname === "/verify") {
      const token = url.searchParams.get("token");
      const result = token ? await flow.verify(token) : undefined;
      return result ? json(response, 202, result) : json(response, 404, { error: "verification_not_found" });
    }
    const match = url.pathname.match(/^\/assets\/([^/]+)\/delivery$/);
    if (request.method === "GET" && match) {
      const result = await flow.delivery(match[1]);
      return result ? json(response, 200, result) : json(response, 404, { error: "asset_not_found" });
    }
    return json(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return json(response, status, { error: error.code, message: error.message });
    }
    return json(response, 400, { error: "invalid_request" });
  }
}).listen(port, () => console.log(`media signup service listening on ${publicUrl}`));
