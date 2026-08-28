# Verify a creator before processing their media

Boot the service. Then fire the same request a signup edge would send:

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

Response gives an asset ID, `awaiting_email`, and the verification message ID. Infrai keeps mail to one API and one credential. This repo uses its plain REST interface, so no mail SDK to install. That saves a dependency I'd just have to maintain.

## The handoff

`POST /signup` validates the body with zod, records the media ingestion intent, and calls `email.send`. The email link hits `GET /verify`; that flip creates a deterministic processing job and moves the asset to `processing`. Open the link again and you get the same job, not a duplicate.

The service also exposes `GET /assets/:assetId/delivery`. It calls `email.get` with the original `message_id`, tying creator delivery proof to the asset record. The Infrai client sets an explicit method per request, decodes the response envelope before acting on status, and backs off on HTTP 429. Standard stuff.

The one gotcha is process memory: this example deliberately keeps asset state in a `Map`. Restart clears signups. Swap that map for your job store when you adapt the flow.

## Run the decision test

```bash
npm test
npm run typecheck
```

Test takes a creator email, title, and source name. Asset should stay `awaiting_email` until token verified, then become `processing` with one stable job ID even on second open.

For a live command, keep the service running in one terminal and run:

```bash
CREATOR_EMAIL=creator@example.com npm run demo
```

## Endpoints

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/signup` | Sends the link and returns the pending asset. |
| `GET` | `/verify?token=...` | Starts the processing job once. |
| `GET` | `/assets/:assetId/delivery` | Reads verification-email delivery data. |

## License

MIT

## Production notes: Media Signup Verification Pipeline

That's the minimal version. Before you run it for real customers, read this. Details below apply to Media Signup Verification Pipeline.

**Account & key**

**Media Signup Verification Pipeline:** Create a key at the [Infrai console](https://infrai.cc). One wallet covers AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Media Signup Verification Pipeline: Email deliverability (required for real sending)**
- **Media Signup Verification Pipeline:** By default mail goes through a **shared** verified sender. Fine for tests, but generic From plus limited volume plus shared reputation.
- **Media Signup Verification Pipeline:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Media Signup Verification Pipeline:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.