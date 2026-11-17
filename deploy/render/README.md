# FreeLLMAPI on Render Free

This fork adds a free Render Blueprint and a five-minute external health check. It does not run model inference on Render: requests are forwarded to your configured providers.

## Deploy

1. Open https://render.com/deploy?repo=https://github.com/nocodeknow/freellmapi and select the free Blueprint in `render.yaml`. Region: Singapore. The upstream Dockerfile builds this fork; automatic deploys are off to avoid surprise restarts when syncing upstream.
2. Set these Render secrets (never GitHub source files):
   - `ENCRYPTION_KEY`: generate exactly 64 hexadecimal characters with `openssl rand -hex 32`. Keep it stable and store it securely; changing it breaks encrypted keys and backups.
   - `FREEAPI_CONFIG_JSON`: a JSON object such as `{"admin":{"email":"you@example.com","password":"REPLACE_WITH_A_LONG_UNIQUE_PASSWORD"}}`. The admin is provisioned before the HTTP listener starts. Provider keys can be added through the dashboard after backup verification.
   - `FREEAPI_DB_BACKUP_URL`: an HTTPS endpoint supporting authenticated GET and PUT, or a private Hugging Face dataset resolve URL, for example `https://huggingface.co/datasets/YOUR_ACCOUNT/freellmapi-state/resolve/main/freellmapi.db.backup`. A private Hugging Face dataset and a narrowly scoped write token must be created separately if choosing that option. Never put credentials in the URL.
   - `FREEAPI_DB_BACKUP_TOKEN`: credential for that backup destination. Hugging Face requires write permission for the selected private dataset.
3. Deploy. Check `/api/ping`, log into the dashboard, and verify a successful encrypted backup upload before adding provider keys. The Blueprint declares backup secrets but does not create remote storage. Do not treat an unconfigured backup as persistent storage.
4. Perform a controlled restart before relying on the service. Confirm that your existing dashboard account, unified API key, and settings survive via remote restore. Keep the original encryption key.
5. Set the GitHub repository Actions variable `RENDER_SERVICE_URL` to the actual service origin, e.g. `https://YOUR-ACTUAL-SERVICE.onrender.com` (no `/v1`, query, or token). Do not guess the Render-generated hostname.
6. Enable the **Render keepalive** workflow under Actions if needed; manually run it once and check the result. It requests only `/api/ping`, never an inference endpoint. It skips until the variable exists.
7. Use `https://YOUR-ACTUAL-SERVICE.onrender.com/v1` with the unified API key copied from the dashboard.

The repository variable can also be set with:

```sh
gh variable set RENDER_SERVICE_URL --repo nocodeknow/freellmapi --body https://YOUR-ACTUAL-SERVICE.onrender.com
gh workflow enable render-keepalive.yml --repo nocodeknow/freellmapi
gh workflow run render-keepalive.yml --repo nocodeknow/freellmapi
```

Do not run multiple Render instances against the same snapshot destination. This is periodic snapshot backup, not a shared database or transactional remote persistence. Up to five minutes of recent changes can be lost on an abrupt restart, and a failed upload makes that window longer. Restores must be tested. Analytics and rate counters can roll back too.

## Keepalive limitations

The cron expression `2-57/5 * * * *` runs every five minutes away from the top of the hour. GitHub can delay/drop scheduled jobs and automatically disables public-repository schedules after 60 days without repository activity. Fork workflows may require initial enabling. A missed ping can allow Render to sleep; the next request can wake it, typically taking about a minute. This is best-effort, not an uptime guarantee. A cron inside the sleeping container would not solve this.

A continuously awake service uses 720 hours in a 30-day month or 744 in a 31-day month, out of Render's shared 750 free instance-hours per workspace. Other free services consume that same allowance.

## Other Render Free limitations

- SQLite and other local changes disappear on spin-down, restart and redeploy. Free services cannot attach persistent disks. Encrypted remote backup is required for this deployment to retain mutable state.
- Render can restart the service at any time, regardless of keepalive.
- Memory/CPU limits can affect large prompts, buffering, concurrency and startup. There is no completed Render load test for this fork.
- Outbound bandwidth and build minutes have allowances; exhausting them can cause charges or suspension/build restrictions depending on billing settings.
- Render may suspend a free service for unusually high outbound traffic. This matters for an API gateway and frequent remote backups.
- No horizontal scaling or service shell/SSH on the free plan. Free Render Postgres expires after 30 days, so it is not a permanent free persistence workaround; this app uses SQLite anyway.
- Upstream providers still impose quotas, account eligibility, regional/datacenter-IP restrictions and availability limits.
- The health endpoint proves that the gateway responds, not that any provider has available quota.

References: https://render.com/docs/free and https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

## Validation

`node --test deploy/render/keepalive.test.mjs` covers URL restrictions, no-inference health requests, retry after a 503 and bounded failure. Both YAML files were parsed locally. The upstream application code and Dockerfile are unchanged. A full image build, live backup/restore and live Render request remain deployment-time checks.
