# Shukatsu Backend

就活・インターン情報管理アプリの FastAPI バックエンドです。

## 開発

```bash
uv sync
uv run uvicorn shukatsu_backend.main:app --reload --port 8000
```

## 環境変数

- `DATABASE_URL` - SQLite の URL (例: `sqlite:////data/shukatsu.db`)
- `JWT_SECRET` - JWT 署名用のシークレット
- `CORS_ORIGINS` - カンマ区切りの許可 Origin
- `RESEND_API_KEY` - (任意) メール通知用
