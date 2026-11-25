# Multi-stage Dockerfile for KrishiSetu DSS
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build:static

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY run_server.py .
COPY --from=frontend-builder /app/frontend/out ./frontend/out

ENV PORT=8000
EXPOSE 8000

CMD ["python", "run_server.py"]
