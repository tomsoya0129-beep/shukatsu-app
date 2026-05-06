import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Plan, PlanEntry } from "../types";

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

export default function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedDay, setCopiedDay] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [showAddEntry, setShowAddEntry] = useState<string | null>(null);
  const [newEntryContent, setNewEntryContent] = useState("");
  const [newEntryBookName, setNewEntryBookName] = useState("");
  const [newEntryDuration, setNewEntryDuration] = useState("");
  const [newEntryDetail, setNewEntryDetail] = useState("");
  const [newEntryType, setNewEntryType] = useState("test");

  const loadPlan = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    const data = await api.get<Plan>(`/api/plans/${planId}`);
    setPlan(data);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const regenerate = async () => {
    if (!planId) return;
    if (!confirm("スケジュールを再生成しますか？手動で追加したエントリも削除されます。")) return;
    await api.post(`/api/plans/${planId}/generate`, {});
    loadPlan();
    showToast("スケジュールを再生成しました");
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const getEntriesForDate = (dateStr: string): PlanEntry[] => {
    if (!plan) return [];
    return plan.entries
      .filter((e) => e.date === dateStr)
      .sort((a, b) => a.sort_order - b.sort_order);
  };

  const getDatesGroupedByWeek = (): string[][] => {
    if (!plan) return [];
    const start = new Date(plan.start_date + "T00:00:00");
    const end = new Date(plan.end_date + "T00:00:00");
    const weeks: string[][] = [];
    let current = new Date(start);

    // Align to Monday
    const startDay = current.getDay();
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    current.setDate(current.getDate() + mondayOffset);

    while (current <= end || weeks.length === 0) {
      const week: string[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = current.toISOString().split("T")[0];
        if (current >= start && current <= end) {
          week.push(dateStr);
        } else {
          week.push("");
        }
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  };

  const formatEntryForCopy = (entry: PlanEntry): string => {
    const lines: string[] = [];
    if (entry.entry_type === "event") {
      lines.push(entry.content);
    } else if (entry.entry_type === "review") {
      const titleLine = entry.book_name
        ? `${entry.book_name} ${entry.duration_display || ""}`
        : "";
      if (titleLine.trim()) lines.push(titleLine.trim());
      lines.push(entry.content);
    } else {
      const titleLine = entry.book_name
        ? `${entry.book_name} ${entry.duration_display || ""}`
        : "";
      if (titleLine.trim()) lines.push(titleLine.trim());
      if (entry.content) lines.push(entry.content);
      if (entry.detail) lines.push(entry.detail);
    }
    return lines.join("\n");
  };

  const copyDayToClipboard = (dateStr: string) => {
    const entries = getEntriesForDate(dateStr);
    const text = entries.map(formatEntryForCopy).join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedDay(dateStr);
      showToast("コピーしました");
      setTimeout(() => setCopiedDay(null), 2000);
    });
  };

  const copyAllToClipboard = () => {
    if (!plan) return;
    const weeks = getDatesGroupedByWeek();
    const allDates = weeks.flat().filter(Boolean);
    const parts: string[] = [];
    for (const dateStr of allDates) {
      const entries = getEntriesForDate(dateStr);
      if (entries.length === 0) continue;
      const d = new Date(dateStr + "T00:00:00");
      const dayName = DAY_NAMES[d.getDay()];
      const label = `${d.getMonth() + 1}/${d.getDate()}（${dayName}）`;
      const content = entries.map(formatEntryForCopy).join("\n\n");
      parts.push(`【${label}】\n${content}`);
    }
    if (plan.notes) {
      parts.push(`\n注意点ポイント\n${plan.notes}`);
    }
    navigator.clipboard.writeText(parts.join("\n\n")).then(() => {
      showToast("全日程をコピーしました");
    });
  };

  const addManualEntry = async (dateStr: string) => {
    if (!planId || !newEntryContent.trim()) return;
    const maxSort = Math.max(0, ...getEntriesForDate(dateStr).map((e) => e.sort_order));
    await api.post(`/api/plans/${planId}/entries`, {
      date: dateStr,
      entry_type: newEntryType,
      book_name: newEntryBookName.trim() || null,
      duration_display: newEntryDuration.trim() || null,
      content: newEntryContent.trim(),
      detail: newEntryDetail.trim() || null,
      sort_order: maxSort + 1,
    });
    setShowAddEntry(null);
    setNewEntryContent("");
    setNewEntryBookName("");
    setNewEntryDuration("");
    setNewEntryDetail("");
    setNewEntryType("test");
    loadPlan();
    showToast("エントリを追加しました");
  };

  const deleteEntry = async (entryId: string) => {
    if (!planId) return;
    await api.del(`/api/plans/${planId}/entries/${entryId}`);
    loadPlan();
  };

  if (loading) return <div className="empty-state">読み込み中...</div>;
  if (!plan) return <div className="empty-state">計画が見つかりません</div>;

  const weeks = getDatesGroupedByWeek();

  return (
    <div>
      <div className="flex-between mb-2">
        <div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate("/plans")}
            style={{ marginRight: "0.5rem" }}
          >
            ← 戻る
          </button>
          <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>
            {plan.name}
          </span>
          <span
            style={{
              marginLeft: "0.5rem",
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
            }}
          >
            {plan.student?.name} | {plan.start_date} 〜 {plan.end_date}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={regenerate}>
            再生成
          </button>
          <button className="btn btn-success btn-sm" onClick={copyAllToClipboard}>
            全日程コピー
          </button>
        </div>
      </div>

      {/* Schedule Grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="card" style={{ padding: "0", overflow: "hidden" }}>
          <table style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                {["月", "火", "水", "木", "金", "土", "日"].map((day, di) => (
                  <th
                    key={di}
                    className={`schedule-header-cell ${di >= 5 ? "weekend" : ""}`}
                    style={{
                      background: di >= 5 ? "#dbeafe" : "#f1f5f9",
                      textAlign: "center",
                      borderRight:
                        di < 6 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {week.map((dateStr, di) => {
                  if (!dateStr) {
                    return (
                      <td
                        key={di}
                        className="schedule-day-cell"
                        style={{ background: "#f8fafc" }}
                      />
                    );
                  }
                  const d = new Date(dateStr + "T00:00:00");
                  const entries = getEntriesForDate(dateStr);
                  const isWeekend = di >= 5;

                  return (
                    <td
                      key={di}
                      className="schedule-day-cell"
                      style={{
                        background: isWeekend ? "#f0f7ff" : "white",
                        verticalAlign: "top",
                      }}
                    >
                      <div className="day-date">
                        {d.getDate()}
                        <button
                          className={`btn btn-copy ${copiedDay === dateStr ? "copied" : ""}`}
                          onClick={() => copyDayToClipboard(dateStr)}
                          style={{ marginLeft: "0.3rem" }}
                          title="この日をコピー"
                        >
                          {copiedDay === dateStr ? "済" : "コピー"}
                        </button>
                      </div>

                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`schedule-entry ${entry.entry_type}`}
                          style={{ position: "relative" }}
                        >
                          {entry.entry_type === "event" ? (
                            <div className="entry-title">{entry.content}</div>
                          ) : (
                            <>
                              {entry.book_name && (
                                <div className="entry-title">
                                  {entry.book_name}{" "}
                                  {entry.duration_display && (
                                    <span style={{ fontWeight: 400 }}>
                                      {entry.duration_display}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div
                                className={
                                  entry.entry_type === "review"
                                    ? "entry-title"
                                    : "entry-detail"
                                }
                              >
                                {entry.content}
                              </div>
                              {entry.detail && (
                                <div className="entry-detail">{entry.detail}</div>
                              )}
                            </>
                          )}
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => deleteEntry(entry.id)}
                            style={{
                              position: "absolute",
                              top: 0,
                              right: 0,
                              fontSize: "0.6rem",
                              padding: "0 0.2rem",
                              opacity: 0.5,
                              lineHeight: 1,
                            }}
                            title="削除"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setShowAddEntry(dateStr);
                          setNewEntryType("test");
                        }}
                        style={{
                          fontSize: "0.65rem",
                          padding: "0.1rem 0.3rem",
                          marginTop: "0.2rem",
                          opacity: 0.6,
                        }}
                      >
                        +追加
                      </button>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {/* Notes section */}
      {plan.notes && (
        <div className="card">
          <h3
            style={{
              fontSize: "0.9rem",
              color: "var(--danger)",
              marginBottom: "0.5rem",
            }}
          >
            注意点ポイント
          </h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{plan.notes}</p>
        </div>
      )}

      {/* Copy Preview */}
      <div className="card">
        <div className="flex-between mb-1">
          <h3 style={{ fontSize: "1rem" }}>コピー用テキスト（日付ごと）</h3>
        </div>
        <p className="help-text mb-1">
          各日付の「コピー」ボタンを押すと、その日の内容がクリップボードにコピーされます。
          Google スプレッドシートにそのまま貼り付けできます。
        </p>
        {weeks.flat().filter(Boolean).map((dateStr) => {
          const entries = getEntriesForDate(dateStr);
          if (entries.length === 0) return null;
          const d = new Date(dateStr + "T00:00:00");
          const dayName = DAY_NAMES[d.getDay()];
          const text = entries.map(formatEntryForCopy).join("\n\n");
          return (
            <div key={dateStr} style={{ marginBottom: "0.5rem" }}>
              <div className="flex-between">
                <strong style={{ fontSize: "0.85rem" }}>
                  {d.getMonth() + 1}/{d.getDate()}（{dayName}）
                </strong>
                <button
                  className={`btn btn-copy ${copiedDay === dateStr ? "copied" : ""}`}
                  onClick={() => copyDayToClipboard(dateStr)}
                >
                  {copiedDay === dateStr ? "コピー済" : "コピー"}
                </button>
              </div>
              <div className="copy-area">{text}</div>
            </div>
          );
        })}
      </div>

      {/* Add Entry Modal */}
      {showAddEntry && (
        <div
          className="modal-overlay"
          onClick={() => setShowAddEntry(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <h2>エントリ追加 ({showAddEntry})</h2>
            <div className="form-group">
              <label>タイプ</label>
              <select
                value={newEntryType}
                onChange={(e) => setNewEntryType(e.target.value)}
              >
                <option value="test">確認テスト</option>
                <option value="study">学習</option>
                <option value="review">復習</option>
                <option value="event">イベント</option>
              </select>
            </div>
            {newEntryType !== "event" && (
              <>
                <div className="form-group">
                  <label>参考書名</label>
                  <input
                    value={newEntryBookName}
                    onChange={(e) => setNewEntryBookName(e.target.value)}
                    placeholder="例：セミナー物理"
                  />
                </div>
                <div className="form-group">
                  <label>時間表示</label>
                  <input
                    value={newEntryDuration}
                    onChange={(e) => setNewEntryDuration(e.target.value)}
                    placeholder="例：0.75h, 15分"
                  />
                </div>
              </>
            )}
            <div className="form-group">
              <label>内容</label>
              <input
                value={newEntryContent}
                onChange={(e) => setNewEntryContent(e.target.value)}
                placeholder={
                  newEntryType === "event"
                    ? "例：練習試合"
                    : "例：第3章-11, ★復習"
                }
                autoFocus
              />
            </div>
            {newEntryType !== "event" && (
              <div className="form-group">
                <label>詳細</label>
                <input
                  value={newEntryDetail}
                  onChange={(e) => setNewEntryDetail(e.target.value)}
                  placeholder="例：(基礎・2日目), p.93-94"
                />
              </div>
            )}
            <div className="flex-between mt-2">
              <button
                className="btn btn-outline"
                onClick={() => setShowAddEntry(null)}
              >
                キャンセル
              </button>
              <button
                className="btn btn-primary"
                onClick={() => addManualEntry(showAddEntry)}
                disabled={!newEntryContent.trim()}
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
