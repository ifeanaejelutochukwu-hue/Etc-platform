FROM golang:1.23-alpine AS builder
WORKDIR /app

# Install build deps for SQLite (CGO not needed for modernc/sqlite)
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /etc-server ./cmd/etc-server

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /etc-server /app/etc-server

# Railway injects $PORT; default to 8080 for local runs
ENV PORT=8080
EXPOSE 8080

CMD ["/app/etc-server"]
