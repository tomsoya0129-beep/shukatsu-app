"""AI-powered import: parse email text or screenshot into structured event data."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import date as date_cls
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from ..auth import get_current_user
from ..config import settings
from ..models import User


router = APIRouter(prefix="/api/import", tags=["import"])
logger = logging.getLogger(__name__)


class ParsedEvent(BaseModel):
    company_name: Optional[str] = None
    event_kind: Optional[str] = None  # "internship_step" | "selection_step" | "internship" | "selection"
    step_type: Optional[str] = None  # briefing/es/aptitude/gd/interview_1..final/other
    label: Optional[str] = None
    scheduled_date: Optional[str] = None  # YYYY-MM-DD
    scheduled_time: Optional[str] = None  # HH:MM
    start_date: Optional[str] = None
    start_time: Optional[str] = None
    end_date: Optional[str] = None
    end_time: Optional[str] = None
    mode: Optional[str] = None  # online | offline
    location: Optional[str] = None
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None
    meeting_password: Optional[str] = None
    mypage_url: Optional[str] = None
    recruit_url: Optional[str] = None
    login_id: Optional[str] = None
    notes: Optional[str] = None


class ParseResponse(BaseModel):
    parsed: ParsedEvent
    raw_text: Optional[str] = None
    confidence: Optional[str] = None


_EXTRACTION_PROMPT = """\
あなたは就活生の予定を整理するアシスタントです。以下のメール本文または画像から、\
イベント情報を抽出して必ず JSON で返してください。

抽出フィールド:
- company_name: 企業名（株式会社等の表記もそのまま）
- event_kind: 「internship_step」(インターンの説明会・選考)「selection_step」(本選考の選考ステップ)「internship」(インターン本体の参加日程)「selection」(その他)のいずれか
- step_type: 以下のいずれか
  - briefing: 説明会・セミナー・イベント
  - es: エントリーシート・ES提出
  - aptitude: 適性検査・SPI・WEBテスト
  - gd: グループディスカッション
  - interview_1: 一次面接
  - interview_2: 二次面接
  - interview_3: 三次面接
  - interview_final: 最終面接・役員面接
  - other: 上記以外
- label: タイトル（人事面談、座談会など補足ある場合）
- scheduled_date: メイン日付（締切なら締切日）YYYY-MM-DD形式
- scheduled_time: 時刻 HH:MM（24時間表記）
- start_date / start_time: 期間がある場合の開始
- end_date / end_time: 期間の終了（インターン本体の最終日など）
- mode: "online" / "offline"
- location: 場所（会場名・住所など）
- online_url: ZoomやGoogle Meet等のURL
- meeting_code: 会議ID
- meeting_password: 会議パスワード
- mypage_url: 採用マイページのURL（「マイページ」「会員ページ」「マイナビ・リクナビ等の応募ページ」など）
- recruit_url: 採用情報・募集要項ページのURL（「採用ページ」「募集ページ」「応募はこちら」など）
- login_id: マイページのログインID（「ID:」「ユーザーID:」「会員ID:」「ログインID:」のような表記）
- notes: その他のメモ

ルール:
- 不明な値は null にする
- 日付の年が省略されている場合、今年または来年で文脈から判断する
- 「9/15」のような表記は適切にパースする
- 締切系（ES提出、適性検査）は scheduled_date を締切日として扱う
- 説明会やセミナー＝briefing
- 日付や時刻が文章にない場合は、すべての日時関連フィールドを null にする（推測しない）
- 仮パスワードは meeting_password ではなく notes に「仮PW: xxxx」として書く（誤って会議パスワードに混ぜないこと）
- 必ず単一のJSONオブジェクトで回答（説明文不要、JSONのみ）

今日の日付: {today}
"""


def _build_extraction_prompt() -> str:
    today = date_cls.today().isoformat()
    return _EXTRACTION_PROMPT.format(today=today)


_GEMINI_CLIENT = None


def _get_client():
    global _GEMINI_CLIENT
    if _GEMINI_CLIENT is None:
        from google import genai

        _GEMINI_CLIENT = genai.Client(api_key=settings.gemini_api_key)
    return _GEMINI_CLIENT


async def _call_gemini(parts: list) -> ParsedEvent:
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI取り込み機能が未設定です（GEMINI_API_KEY未設定）",
        )

    try:
        from google.genai import types as genai_types
    except ImportError as e:
        logger.error("google-genai not installed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI取り込み機能の依存パッケージが見つかりません",
        )

    client = _get_client()

    # Disable thinking for speed (high-speed mode, not deep reasoning)
    config = genai_types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=ParsedEvent,
        temperature=0.1,
        thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
    )

    # Strategy: try multiple Gemini models in order. Each model has its own
    # free-tier quota bucket (RPM/RPD), so cycling through them gives the user
    # the best chance of getting a successful parse even during peak usage.
    # Order: primary (fastest+highest RPD) -> latest aliases -> flash -> retry primary
    candidate_models: list[str] = []
    seen: set[str] = set()
    for m in [
        settings.gemini_model,           # default: gemini-2.5-flash-lite (1000 RPD)
        "gemini-flash-latest",            # alias, often different quota bucket
        "gemini-flash-lite-latest",       # alias for lite
        "gemini-2.5-flash",               # higher quality, smaller RPD (~250)
    ]:
        if m and m not in seen:
            seen.add(m)
            candidate_models.append(m)

    last_err: Exception | None = None
    response = None
    quota_exhausted_all = True  # becomes False if any non-quota error happens

    for model_name in candidate_models:
        try:
            t0 = time.time()
            response = await asyncio.wait_for(
                client.aio.models.generate_content(
                    model=model_name,
                    contents=parts,
                    config=config,
                ),
                timeout=20.0,
            )
            logger.info(
                "Gemini %s OK in %.2fs", model_name, time.time() - t0,
            )
            last_err = None
            break
        except asyncio.TimeoutError:
            last_err = TimeoutError(f"Gemini {model_name} timeout after 20s")
            logger.warning("Gemini %s timeout", model_name)
            quota_exhausted_all = False
            continue
        except Exception as e:  # noqa: BLE001
            last_err = e
            msg = str(e)
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                logger.warning("Gemini %s quota exhausted: %s", model_name, msg[:200])
                continue  # try next model with separate quota
            if "503" in msg or "UNAVAILABLE" in msg or "overloaded" in msg.lower():
                logger.warning("Gemini %s overloaded: %s", model_name, msg[:120])
                quota_exhausted_all = False
                await asyncio.sleep(0.3)
                continue
            quota_exhausted_all = False
            logger.exception("Gemini API call failed on %s", model_name)
            continue

    if response is None:
        msg = str(last_err) if last_err else "unknown error"
        if quota_exhausted_all:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="本日のAI無料枠を使い切ってしまいました。1分ほど待つか、明日（UTC基準）以降にお試しください。",
            )
        if "timeout" in msg.lower() or "503" in msg or "UNAVAILABLE" in msg or "overloaded" in msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AIモデルが一時的に混雑しています。30秒〜1分ほどおいて再度お試しください。",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI解析に失敗しました: {msg[:200]}",
        )

    text = response.text or "{}"
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Gemini returned non-JSON: %s", text[:200])
        s = text.find("{")
        e = text.rfind("}")
        if s >= 0 and e > s:
            try:
                data = json.loads(text[s : e + 1])
            except json.JSONDecodeError:
                data = {}
        else:
            data = {}

    return ParsedEvent(**{k: v for k, v in data.items() if k in ParsedEvent.model_fields})


@router.post("/parse-text", response_model=ParseResponse)
async def parse_text(
    payload: dict,
    user: User = Depends(get_current_user),
):
    text = (payload or {}).get("text") or ""
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="テキストが空です")
    if len(text) > 20000:
        text = text[:20000]

    prompt = _build_extraction_prompt()
    parsed = await _call_gemini([prompt, text])
    return ParseResponse(parsed=parsed, raw_text=text[:500])


@router.post("/parse-image", response_model=ParseResponse)
async def parse_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="画像ファイルを指定してください")

    blob = await file.read()
    if len(blob) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="画像は10MB以下にしてください")

    try:
        from google.genai import types as genai_types
    except ImportError:
        raise HTTPException(status_code=503, detail="AI取り込み機能の依存パッケージが見つかりません")

    image_part = genai_types.Part.from_bytes(
        data=blob, mime_type=file.content_type or "image/png"
    )

    prompt = _build_extraction_prompt()
    parsed = await _call_gemini([prompt, image_part])
    return ParseResponse(parsed=parsed)


@router.get("/status")
def import_status(user: User = Depends(get_current_user)):
    """Check whether AI import is configured."""
    return {
        "available": bool(settings.gemini_api_key),
        "model": settings.gemini_model if settings.gemini_api_key else None,
    }
