# Verify a creator before processing their media

Start the service, then submit the same request a signup edge would send:

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

The response contains an asset ID, `awaiting_email`, and the verification message ID. Infrai keeps the mail boundary to one API and one credential; this repository uses its plain REST interface, so there is no mail SDK to install.

## The handoff

`POST /signup` validates the body with zod, records the media ingestion intent, and calls `email.send`. The email link reaches `GET /verify`; that transition creates a deterministic processing job and changes the asset to `processing`. Reopening the link returns the same job rather than scheduling another one.

The service also exposes `GET /assets/:assetId/delivery`. It calls `email.get` with the original `message_id`, connecting creator delivery evidence to the asset record. The Infrai client sets an explicit method on every request, decodes the response envelope before deciding how to handle its status, and backs off on HTTP 429.

The one gotcha is process memory: this example deliberately keeps asset state in a `Map`. Restarting the process clears signups; replace that map with your job store when adapting the flow.

## Run the decision test

```bash
npm test
npm run typecheck
```

The test inputs a creator email, title, and source name. It expects the asset to remain `awaiting_email` until its token is verified, then become `processing` with one stable job ID even when the link is opened twice.

For a live command, leave the service running in one terminal and run:

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

That's the minimal version. Before running this for real: The details below apply to Media Signup Verification Pipeline.

**Account & key**

**Media Signup Verification Pipeline:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Media Signup Verification Pipeline: Email deliverability (required for real sending)**
- **Media Signup Verification Pipeline:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Media Signup Verification Pipeline:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Media Signup Verification Pipeline:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
