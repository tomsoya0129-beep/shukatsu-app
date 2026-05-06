import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Plan, Student, Book, PlanSubject, PlanDayEvent } from "../types";

const DAY_LABELS: Record<string, string> = {
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
  sat: "土",
  sun: "日",
};

const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export default function PlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [p, s, b] = await Promise.all([
      api.get<Plan[]>("/api/plans"),
      api.get<Student[]>("/api/students"),
      api.get<Book[]>("/api/books"),
    ]);
    setPlans(p);
    setStudents(s);
    setBooks(b);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("この計画を削除しますか？")) return;
    await api.del(`/api/plans/${id}`);
    loadData();
  };

  return (
    <div>
      <div className="flex-between mb-2">
        <h2>計画一覧</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(true)}
          disabled={students.length === 0 || books.length === 0}
        >
          + 新規計画作成
        </button>
      </div>

      {students.length === 0 && (
        <div className="card empty-state">
          先に生徒を登録してください。
        </div>
      )}
      {books.length === 0 && students.length > 0 && (
        <div className="card empty-state">
          先に参考書を登録してください。
        </div>
      )}

      {loading ? (
        <div className="empty-state">読み込み中...</div>
      ) : plans.length === 0 && students.length > 0 && books.length > 0 ? (
        <div className="card empty-state">
          計画がありません。「新規計画作成」ボタンから作成してください。
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>計画名</th>
                <th>生徒</th>
                <th>期間</th>
                <th>教科数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/plans/${p.id}`);
                      }}
                      style={{ fontWeight: 600, color: "var(--primary)" }}
                    >
                      {p.name}
                    </a>
                  </td>
                  <td>{p.student?.name || "—"}</td>
                  <td>
                    {p.start_date} 〜 {p.end_date}
                  </td>
                  <td>{p.subjects.length}</td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => navigate(`/plans/${p.id}`)}
                      style={{ marginRight: "0.3rem" }}
                    >
                      詳細
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(p.id)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <PlanFormModal
          students={students}
          books={books}
          onClose={() => setShowForm(false)}
          onSave={(planId) => {
            setShowForm(false);
            navigate(`/plans/${planId}`);
          }}
        />
      )}
    </div>
  );
}

interface PlanFormModalProps {
  students: Student[];
  books: Book[];
  onClose: () => void;
  onSave: (planId: string) => void;
}

function PlanFormModal({ students, books, onClose, onSave }: PlanFormModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const twoWeeksLater = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [planName, setPlanName] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(twoWeeksLater);
  const [notes, setNotes] = useState("");
  const [subjects, setSubjects] = useState<PlanSubject[]>([]);
  const [dayEvents, setDayEvents] = useState<PlanDayEvent[]>([]);
  const [saving, setSaving] = useState(false);

  // Event form
  const [eventDate, setEventDate] = useState("");
  const [eventContent, setEventContent] = useState("");
  const [eventIsOff, setEventIsOff] = useState(false);

  const addSubject = () => {
    if (books.length === 0) return;
    setSubjects([
      ...subjects,
      {
        book_id: books[0].id,
        display_name: "",
        start_unit_index: 0,
        duration_hours: 0.75,
        duration_display: "0.75h",
        units_per_day: 1,
        study_days: ["mon", "tue", "wed", "thu", "fri", "sat"],
        review_interval: undefined,
        review_type: "review",
        on_completion: "stop",
        sort_order: subjects.length,
      },
    ]);
  };

  const updateSubject = (index: number, updates: Partial<PlanSubject>) => {
    const newSubjects = [...subjects];
    newSubjects[index] = { ...newSubjects[index], ...updates };
    setSubjects(newSubjects);
  };

  const removeSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  const addDayEvent = () => {
    if (!eventDate || !eventContent.trim()) return;
    setDayEvents([
      ...dayEvents,
      {
        date: eventDate,
        event_type: "event",
        content: eventContent.trim(),
        is_off_day: eventIsOff,
      },
    ]);
    setEventContent("");
    setEventIsOff(false);
  };

  const removeDayEvent = (index: number) => {
    setDayEvents(dayEvents.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!studentId || !planName.trim() || !startDate || !endDate) return;
    setSaving(true);
    const data = {
      student_id: studentId,
      name: planName.trim(),
      start_date: startDate,
      end_date: endDate,
      notes: notes.trim() || null,
      subjects: subjects.map((s, i) => ({ ...s, sort_order: i })),
      day_events: dayEvents,
    };
    const plan = await api.post<Plan>("/api/plans", data);
    // Auto-generate schedule
    await api.post(`/api/plans/${plan.id}/generate`, {});
    setSaving(false);
    onSave(plan.id);
  };

  const getBookUnits = (bookId: string) => {
    return books.find((b) => b.id === bookId)?.units || [];
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "900px" }}
      >
        <h2>新規計画作成</h2>

        <div className="form-row">
          <div className="form-group">
            <label>生徒</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.grade ? `(${s.grade})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label>計画名</label>
            <input
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="例：4月第1-2週"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>開始日</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>終了日</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Subjects */}
        <div className="flex-between mt-2 mb-1">
          <h3 style={{ fontSize: "1rem" }}>教科設定 ({subjects.length}件)</h3>
          <button className="btn btn-primary btn-sm" onClick={addSubject}>
            + 教科追加
          </button>
        </div>

        {subjects.length === 0 ? (
          <div
            className="empty-state"
            style={{ padding: "1rem", background: "#f8fafc", borderRadius: "8px" }}
          >
            教科を追加してください
          </div>
        ) : (
          subjects.map((subj, i) => (
            <div className="subject-card" key={i}>
              <div className="subject-header">
                <strong>教科 {i + 1}</strong>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => removeSubject(i)}
                >
                  削除
                </button>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>参考書</label>
                  <select
                    value={subj.book_id}
                    onChange={(e) =>
                      updateSubject(i, {
                        book_id: e.target.value,
                        start_unit_index: 0,
                      })
                    }
                  >
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.units.length}単元)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>表示名（省略可）</label>
                  <input
                    value={subj.display_name || ""}
                    onChange={(e) =>
                      updateSubject(i, { display_name: e.target.value || undefined })
                    }
                    placeholder="参考書名と同じ"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>開始単元</label>
                  <select
                    value={subj.start_unit_index}
                    onChange={(e) =>
                      updateSubject(i, {
                        start_unit_index: parseInt(e.target.value),
                      })
                    }
                  >
                    {getBookUnits(subj.book_id).map((u, ui) => (
                      <option key={ui} value={ui}>
                        {u.label}
                        {u.title ? ` ${u.title}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>所要時間表示</label>
                  <select
                    value={subj.duration_display}
                    onChange={(e) => {
                      const display = e.target.value;
                      let hours = 0.75;
                      if (display.endsWith("h")) hours = parseFloat(display);
                      else if (display === "15分") hours = 0.25;
                      else if (display === "30分") hours = 0.5;
                      else if (display === "45分") hours = 0.75;
                      updateSubject(i, {
                        duration_display: display,
                        duration_hours: hours,
                      });
                    }}
                  >
                    <option value="15分">15分</option>
                    <option value="30分">30分</option>
                    <option value="0.5h">0.5h</option>
                    <option value="0.75h">0.75h</option>
                    <option value="1.0h">1.0h</option>
                    <option value="1.5h">1.5h</option>
                    <option value="2.0h">2.0h</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>1日の単元数</label>
                  <select
                    value={subj.units_per_day}
                    onChange={(e) =>
                      updateSubject(i, {
                        units_per_day: parseInt(e.target.value),
                      })
                    }
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}単元/日
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>復習間隔</label>
                  <select
                    value={subj.review_interval || 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      updateSubject(i, {
                        review_interval: val || undefined,
                      });
                    }}
                  >
                    <option value={0}>復習なし</option>
                    <option value={3}>3日ごと</option>
                    <option value={4}>4日ごと</option>
                    <option value={5}>5日ごと</option>
                    <option value={6}>6日ごと</option>
                    <option value={7}>7日ごと</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>完了後の動作</label>
                  <select
                    value={subj.on_completion}
                    onChange={(e) =>
                      updateSubject(i, { on_completion: e.target.value })
                    }
                  >
                    <option value="stop">停止</option>
                    <option value="repeat">繰り返し（2周目）</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>実施曜日</label>
                <div className="checkbox-group">
                  {ALL_DAYS.map((d) => (
                    <label key={d}>
                      <input
                        type="checkbox"
                        checked={subj.study_days.includes(d)}
                        onChange={(e) => {
                          const days = e.target.checked
                            ? [...subj.study_days, d]
                            : subj.study_days.filter((x) => x !== d);
                          updateSubject(i, { study_days: days });
                        }}
                      />
                      {DAY_LABELS[d]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Day Events */}
        <div className="flex-between mt-2 mb-1">
          <h3 style={{ fontSize: "1rem" }}>イベント・休日</h3>
        </div>
        <div className="subject-card">
          <div className="form-row">
            <div className="form-group">
              <label>日付</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>内容</label>
              <input
                value={eventContent}
                onChange={(e) => setEventContent(e.target.value)}
                placeholder="例：練習試合、地区予選、次回面談日18:00-"
              />
            </div>
            <div className="form-group" style={{ flex: 0.5 }}>
              <label>
                <input
                  type="checkbox"
                  checked={eventIsOff}
                  onChange={(e) => setEventIsOff(e.target.checked)}
                  style={{ width: "auto", marginRight: "0.3rem" }}
                />
                休日
              </label>
            </div>
            <div className="form-group" style={{ flex: 0.3 }}>
              <label>&nbsp;</label>
              <button className="btn btn-primary btn-sm" onClick={addDayEvent}>
                追加
              </button>
            </div>
          </div>
          {dayEvents.length > 0 && (
            <div className="mt-1">
              {dayEvents.map((ev, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.3rem",
                    background: ev.is_off_day ? "#fef2f2" : "#f0fdf4",
                    borderRadius: "4px",
                    marginBottom: "0.2rem",
                  }}
                >
                  <span>
                    {ev.date} - {ev.content}
                    {ev.is_off_day && " (休日)"}
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => removeDayEvent(i)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="form-group mt-2">
          <label>注意点・ポイント</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="例：宇宙一は一冊で完成ではなくて、宇宙一を踏み台にして問題を解くイメージです"
          />
        </div>

        <div className="flex-between mt-2">
          <button className="btn btn-outline" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving || !planName.trim() || subjects.length === 0}
          >
            {saving ? "作成中..." : "計画を作成して生成"}
          </button>
        </div>
      </div>
    </div>
  );
}
