# 学習計画アプリ (Study Scheduler)

塾講師向けの学習計画作成アプリです。生徒ごとにパーソナライズされた2週間の学習計画を作成し、Google スプレッドシートにコピペできる形式で出力します。

## 機能

### 📚 参考書ライブラリ
- 参考書の名前・目次（章・ページ数）を登録
- **章・セクション形式**（一般的な教科書）
- **問題番号形式**（英文解釈の技術70など、1〜70の連番）
- **一括入力**：目次をそのままコピペしてパース
- **連番生成**：開始番号〜終了番号で自動生成

### 👤 生徒管理
- 生徒の名前・学年・メモを登録
- 複数の生徒を管理

### 📋 計画作成
- 参考書ライブラリから教科を選択追加
- 開始単元をプルダウンで選択
- 所要時間（0.75h, 1.0h, 15分など）を設定
- 1日の単元数を設定
- 実施曜日を選択
- 復習間隔（3日ごと、5日ごとなど）を設定
- 完了後の動作（停止 / 繰り返し）を選択
- イベント・休日の設定
- 注意点ポイントの記入

### 📋 コピー機能
- 日付ごとにコピーボタン付き
- Google スプレッドシートに貼り付け可能な形式
- 全日程一括コピー
- 改行・空白を画像通りに出力

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: FastAPI (Python)
- **データベース**: Supabase (PostgreSQL)

## セットアップ

### 前提条件
- Node.js 22+
- Python 3.11+
- Supabase PostgreSQL データベース

### データベース初期化
```bash
psql $DATABASE_URL -f schema.sql
```

### バックエンド起動
```bash
cd backend
pip install -r requirements.txt
DATABASE_URL="postgresql://..." uvicorn main:app --reload --port 8000
```

### フロントエンド起動
```bash
npm install
npm run dev
```

### 本番ビルド
```bash
npm run build
cp -r dist backend/static
DATABASE_URL="postgresql://..." uvicorn main:app --host 0.0.0.0 --port 8000
```

## Docker
```bash
docker build -t study-scheduler .
docker run -e DATABASE_URL="postgresql://..." -p 8000:8000 study-scheduler
```
