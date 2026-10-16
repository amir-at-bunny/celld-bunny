import { DurableObject } from "cloudflare:workers";

// One Room per name. Each Room is a single-threaded actor with its own SQLite
// database; celld runs it on exactly one node at a time and replicates every
// write to the bucket before the response leaves.
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      at TEXT NOT NULL
    )`);
  }

  post(author, body) {
    this.sql.exec(
      "INSERT INTO messages (author, body, at) VALUES (?, ?, ?)",
      author,
      body,
      new Date().toISOString(),
    );
    return this.history();
  }

  history() {
    const messages = this.sql
      .exec("SELECT id, author, body, at FROM messages ORDER BY id DESC LIMIT 50")
      .toArray();
    const { total } = this.sql.exec("SELECT count(*) AS total FROM messages").one();
    return { id: this.ctx.id.toString(), total, messages };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    const match = url.pathname.match(/^\/rooms\/([a-z0-9-]{1,40})$/);
    if (!match) return new Response("not found", { status: 404 });

    // idFromName is deterministic: the same name reaches the same Room from any node.
    const room = env.ROOMS.get(env.ROOMS.idFromName(match[1]));

    if (request.method === "GET") return Response.json(await room.history());
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });

    const { author, body } = await request.json().catch(() => ({}));
    if (typeof author !== "string" || typeof body !== "string" || !author.trim() || !body.trim()) {
      return Response.json({ error: "author and body are required" }, { status: 400 });
    }
    return Response.json(await room.post(author.trim().slice(0, 40), body.trim().slice(0, 500)));
  },
};

const PAGE = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>celld rooms</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
  input, button { font: inherit; padding: .4rem .6rem; }
  form { display: flex; gap: .5rem; flex-wrap: wrap; margin: 1rem 0; }
  #body { flex: 1; min-width: 12rem; }
  li { margin: .3rem 0; }
  small, code { color: #666; }
</style>
<h1>celld rooms</h1>
<p>Each room is one Durable Object. Room: <input id="room" value="lobby" size="12"></p>
<form id="form">
  <input id="author" placeholder="name" size="10" required>
  <input id="body" placeholder="message" required>
  <button>Send</button>
</form>
<p><small id="meta"></small></p>
<ul id="list"></ul>
<script>
  const $ = (id) => document.getElementById(id);
  const render = (data) => {
    $("meta").textContent = data.total + " messages · object id " + data.id.slice(0, 16) + "…";
    $("list").replaceChildren(...data.messages.map((m) => {
      const li = document.createElement("li");
      li.textContent = m.author + ": " + m.body;
      return li;
    }));
  };
  const path = () => "/rooms/" + encodeURIComponent($("room").value.trim().toLowerCase());
  const load = () => fetch(path()).then((r) => r.json()).then(render);
  $("room").addEventListener("change", load);
  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const r = await fetch(path(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ author: $("author").value, body: $("body").value }),
    });
    render(await r.json());
    $("body").value = "";
  });
  load();
  setInterval(load, 3000);
</script>
`;
