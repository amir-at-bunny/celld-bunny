# celld-bunny

A small chat-rooms app on [celld](https://celld.dev): one Worker plus one Durable Object class (`Room`), with the fleet state kept in a Bunny Storage bucket through its S3 API.

Each room name maps to one `Room` instance. Each instance has its own SQLite database and runs on exactly one node at a time.

## Setup

```sh
npm install
```

Bucket credentials live in `.env.bunny` (gitignored). Copy the example and fill in the two keys:

```sh
cp .env.bunny.example .env.bunny
bunny storage zones credentials celld-bunny --connection s3 --show-secret
```

Don't put them in `.env`: `celld dev` loads `.env` as variables for the Worker.

## Run

| Command          | What it does                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev`    | Local object store in `.celld/dev`, one node, rebuild on save. http://127.0.0.1:9876              |
| `npm run deploy` | Bundle the app and upload a new version to the Bunny bucket. Running nodes pick it up, no restart. |
| `npm run node`   | Start a celld node on this machine against the Bunny bucket. http://127.0.0.1:8080                |
| `npm run cells`  | List the Durable Object cells stored in the bucket.                                               |

## Magic Containers

A single celld node runs on Magic Containers as the app `celld-rooms`, in region DE next to the storage zone. `bunny apps show` prints its public endpoint.

- The image ([Dockerfile](Dockerfile)) is only the celld binary. Your app code comes from the bucket, so shipping app changes is just `npm run deploy`. No container rebuild is needed.
- `npm run deploy:mc` rebuilds and redeploys the node image. `bunny apps deploy` builds it, pushes it to the Bunny registry and updates the app. The build is forced to `linux/amd64`, which is what Magic Containers runs.
- Non-secret settings are in [bunny.jsonc](bunny.jsonc). The bucket keys were set once with `bunny apps env set AWS_ACCESS_KEY_ID …` and `bunny apps env set AWS_SECRET_ACCESS_KEY …`.
- Scaling is fixed at 1. A second instance would need a private network to reach the first one, which isn't set up.
- Don't run `npm run node` locally while the container is up. Both nodes would join the same fleet without being able to reach each other.

## API

- `GET /rooms/:name` returns the room's last 50 messages.
- `POST /rooms/:name` with `{"author": "...", "body": "..."}` adds a message to the room.
- `GET /` serves a small web UI for the API.
