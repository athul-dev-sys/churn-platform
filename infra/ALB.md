# Permanent ALB URL (path-based routing)

## Problem
Fargate tasks get a new public IP on every deploy/restart. Hardcoding those IPs in the frontend or nginx breaks the site.

## Solution
Internet-facing Application Load Balancer `churn-platform-alb` in `ap-south-2`:

| Path | Target | Port |
|------|--------|------|
| `/api/*` | `churn-api` | 3000 |
| `/predict*` | `churn-model-service` | 8000 |
| `/*` (default) | `churn-web` | 80 |

Frontend uses **relative** `/api/...` calls (same ALB host). No container IPs in the browser.

## One-time provision (run locally with AWS CLI configured)

**PowerShell (Windows):**
```powershell
cd churn-platform
.\infra\setup-alb.ps1
```

**Bash (Git Bash / WSL / macOS / Linux):**
```bash
cd churn-platform
chmod +x infra/setup-alb.sh
./infra/setup-alb.sh
```

The script prints:
```text
PERMANENT PLATFORM URL (submit this):
http://churn-platform-alb-xxxxxxxxxxxx.ap-south-2.elb.amazonaws.com
```

Also writes `infra/alb-outputs.env`.

## After the script

1. Set GitHub Actions secrets (same value for both):
   - `MODEL_SERVICE_URL` = `http://<ALB_DNS>`
   - `FRONTEND_URL` = `http://<ALB_DNS>` (optional)
2. Commit & push these code changes to `main` (or run the Deploy workflow manually).
3. Submit the ALB URL from the script / workflow summary.

## Re-print the URL anytime
```powershell
aws elbv2 describe-load-balancers --names churn-platform-alb --region ap-south-2 --query "LoadBalancers[0].DNSName" --output text
```

## Local development
- `apps/web/.env`: `VITE_API_URL=http://localhost:4000` (or leave unset and use the Vite `/api` proxy)
- API already mounts routes at `/api`
