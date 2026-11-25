# Switching on the remaining integrations

What **Admin → Settings → Integrations** shows, and how to turn each one on.

| Integration | This version | How |
|---|---|---|
| Email | On (Gmail SMTP) | `docs/EMAIL_SETUP.md` |
| Payments | On once keys are set | `docs/PAYMENTS_SETUP.md` |
| AI critique | On (Claude) | `docs/AI_SETUP.md` |
| SMS | **Off on purpose** | Not used in this version. Every SMS option is hidden while it's off. |
| Malware scanning | Off → on | [ClamAV](#malware-scanning-clamav), free, runs on your machine |
| Semantic search | Off → on | [Voyage AI or OpenAI key](#semantic-search-answer-bank) |
| File storage | On (local disk) | Fine on your laptop. Needs cloud storage when the site goes online: [below](#file-storage-for-the-live-site) |

## Malware scanning (ClamAV)

Every upload (documents, referee letters) is scanned before it's stored; infected files are refused. Without ClamAV
uploads are marked "not scanned".

On Ubuntu, run these one at a time:

```bash
sudo apt install -y clamav-daemon clamav-freshclam
sudo systemctl stop clamav-freshclam
sudo freshclam
sudo systemctl start clamav-freshclam
```

`freshclam` downloads the virus database (a few hundred MB, takes a few minutes); the service keeps it updated.
Then let ClamAV listen on a local network port (the app talks to it over TCP), on this computer only:

```bash
printf 'TCPSocket 3310\nTCPAddr 127.0.0.1\n' | sudo tee -a /etc/clamav/clamd.conf
sudo systemctl daemon-reload
sudo systemctl restart clamav-daemon.socket clamav-daemon
```

Ubuntu's ClamAV package reads `TCPSocket`/`TCPAddr` from `clamd.conf` and opens the port itself. Don't also add a
`ListenStream` override: the port would be opened twice and the service fails with "Address already in use".

Check it answers (should print `PONG`; the first start can take a minute while the database loads):

```bash
printf 'PING\n' | nc -q1 127.0.0.1 3310
```

Add to `.env` and restart the app:

```bash
CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
```

Upload any document: its page shows **Security scan passed**.

## Semantic search (answer bank)

Lets the **answer bank** find your saved answers by meaning ("a time I led a team" finds "Starting the school coding
club"), not only by matching words. Without it, keyword search is used.

Option A, **Voyage AI** (recommended by Anthropic for use with Claude; new accounts get a free allowance):

1. Create an account at **voyageai.com** → Dashboard → **API keys** → create a key.
2. Add to `.env`:
   ```bash
   EMBEDDINGS_PROVIDER=voyage
   EMBEDDINGS_API_KEY=pa-...
   ```

Option B, **OpenAI**: `EMBEDDINGS_PROVIDER=openai` and `EMBEDDINGS_API_KEY=sk-...` from platform.openai.com.

Restart the app, then in **Admin → Settings → Background jobs** click **embeddings-backfill** once to index existing
answers (new and edited answers are indexed automatically).

## File storage for the live site

On your laptop, uploads are kept in `.dev-storage/`, which is fine. The live site refuses to start with local storage,
because hosting platforms wipe their disks. Use any S3-compatible bucket (private, not public):

- **Supabase Storage**: if you host the database on Supabase. Storage → create a private bucket → Settings → Storage →
  S3 access keys.
- **Cloudflare R2**: free allowance, no egress fees. R2 → create bucket → Manage API tokens.
- **AWS S3**.

Then set on the host:

```bash
STORAGE_DRIVER=s3
STORAGE_BUCKET=soar-documents
S3_ENDPOINT=https://...        # from the provider (leave empty for AWS)
S3_REGION=auto                 # or your AWS region
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

Malware scanning on the live site needs a ClamAV server your host can reach (e.g. the `clamav/clamav` Docker image on
a small VM), set with the same `CLAMAV_HOST`/`CLAMAV_PORT`.
