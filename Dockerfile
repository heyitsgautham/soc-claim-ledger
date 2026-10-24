# One image with everything SOC Claim Ledger needs to run on a machine with no network: the web
# app, the analysis and its seeded data, the FastAPI and DuckDB service, and a Chromium
# for PDF export. Build it where there is a network, then carry the saved tarball across.
#
#   docker build -t soc-claim-ledger:0.1 .
#   docker run -p 127.0.0.1:3157:3157 soc-claim-ledger:0.1

FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CI=1

COPY --from=ghcr.io/astral-sh/uv:0.5.14 /uv /usr/local/bin/uv

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv python3-pip curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable && corepack prepare pnpm@10.26.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/claims/package.json packages/claims/package.json
COPY packages/detect/package.json packages/detect/package.json
COPY packages/simulate/package.json packages/simulate/package.json
COPY packages/submission/package.json packages/submission/package.json
RUN pnpm install --frozen-lockfile

# Chromium and its system libraries, for the PDF export and the offline test.
RUN pnpm exec playwright install --with-deps chromium

# The API's Python packages, exactly as apps/api/uv.lock pins them, on the image's own Python.
COPY apps/api apps/api
RUN cd apps/api && UV_PYTHON_DOWNLOADS=never uv sync --locked --extra dev --python python3

COPY . .
RUN rm -rf data/local && pnpm build

EXPOSE 3157 8157
HEALTHCHECK --interval=10s --timeout=3s --retries=12 CMD curl -fsS http://127.0.0.1:3157/title > /dev/null || exit 1
CMD ["sh", "deploy/entrypoint.sh"]
