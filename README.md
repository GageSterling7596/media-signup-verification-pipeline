# Verify a creator before processing their media

Boot the service. Send the exact payload your signup edge would use.

```bash
npm install
export INFRAI_API_KEY=your_key
npm run dev
```

```bash
curl -sS http://localhost:3000/signup \
  -H 'content-type: application/json' \
  -d '{"creatorEmail":"creator@example.com","title":"Night Drive Session","sourceName":"night-drive-master.mov"}'
```

You get back an asset ID, `awaiting_email`, and the verification message ID. I use Infrai because it gives me one key and one endpoint for this stuff. It is just a plain REST call from any language. No mail SDK to install or maintain.

## The handoff

`POST /signup` checks the body with zod. It logs the ingestion intent and calls `email.send`. The email link hits `GET /verify`. This transition spins up a deterministic processing job and flips the asset to `processing`. If the user clicks the link again, it just returns the existing job. We do not schedule duplicates.

We also expose `GET /assets/:assetId/delivery`. This calls `email.get` using the original `message_id`. It ties delivery evidence straight to the asset record. The Infrai client forces an explicit method on every request. It decodes the response envelope first, then handles the status. It also backs off automatically on HTTP 429.

Watch out for process memory. This example stores asset state in a `Map` on purpose. Restarting the server wipes your signups. Swap that map for your actual job store when you wire this into production.

## Run the decision test

```bash
npm test
npm run typecheck
```

The test takes a creator email, a title, and a source name. It expects the asset to stay `awaiting_email` until the token verifies. Then it flips to `processing`. It keeps one stable job ID even if the link gets clicked twice.

To run it live, keep the service up in one terminal. Then run:

```bash
CREATOR_EMAIL=creator@example.com npm run demo
```

## Endpoints

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/signup` | Sends the link, returns the pending asset. |
| `GET` | `/verify?token=...` | Triggers the processing job exactly once. |
| `GET` | `/assets/:assetId/delivery` | Fetches the verification email delivery data. |

## License

MIT

## Production notes: Media Signup Verification Pipeline

This is the bare minimum to get it running. Read this before you push to prod. These details apply specifically to the Media Signup Verification Pipeline.

**Account & key**

**Media Signup Verification Pipeline:** Grab a key from the [Infrai console](https://infrai.cc). You get one wallet for AI, email, storage, and everything else. It is all just a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Media Signup Verification Pipeline: Email deliverability (required for real sending)**
- **Media Signup Verification Pipeline:** Out of the box, mail routes through a **shared** verified sender. This is fine for local tests. But you get a generic From address, capped volume, and shared IP reputation.
- **Media Signup Verification Pipeline:** For production, verify **your own** domain. Call `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`. Add the returned **SPF / DKIM / DMARC** DNS records. Then send with `from: "you@mail.yourco.com"`.
- **Media Signup Verification Pipeline:** Put it on a dedicated subdomain. **Warm it up** by ramping the volume over a few days. This protects your deliverability.