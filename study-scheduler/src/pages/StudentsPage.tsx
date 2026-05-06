import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { Student } from "../types";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  const loadStudents = async () => {
    setLoading(true);
    const data = await api.get<Student[]>("/api/students");
    setStudents(data);
    setLoading(false);
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const openForm = (student?: Student) => {
    if (student) {
      setEditing(student);
      setName(student.name);
      setGrade(student.grade || "");
      setNotes(student.notes || "");
    } else {
      setEditing(null);
      setName("");
      setGrade("");
      setNotes("");
    }
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      grade: grade.trim() || null,
      notes: notes.trim() || null,
    };
    if (editing) {
      await api.put(`/api/students/${editing.id}`, data);
    } else {
      await api.post("/api/students", data);
    }
    setShowForm(false);
    loadStudents();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この生徒を削除しますか？関連する計画も全て削除されます。")) return;
    await api.del(`/api/students/${id}`);
    loadStudents();
  };

  return (
    <div>
      <div className="flex-between mb-2">
        <h2>生徒管理</h2>
        <button className="btn btn-primary" onClick={() => openForm()}>
          + 生徒を追加
        </button>
      </div>

      {loading ? (
        <div className="empty-state">読み込み中...</div>
      ) : students.length === 0 ? (
        <div className="card empty-state">
          生徒が登録されていません。「生徒を追加」ボタンから追加してください。
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>名前</th>
                <th>学年</th>
                <th>メモ</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.grade || "—"}</td>
                  <td style={{ color: "var(--text-secondary)" }}>
                    {s.notes || "—"}
                  </td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => openForm(s)}
                      style={{ marginRight: "0.3rem" }}
                    >
                      編集
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(s.id)}
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
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "生徒を編集" : "生徒を追加"}</h2>
            <div className="form-group">
              <label>名前</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：田中太郎"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>学年</label>
              <input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="例：高2"
              />
            </div>
            <div className="form-group">
              <label>メモ</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="メモ（任意）"
              />
            </div>
            <div className="flex-between mt-2">
              <button
                className="btn btn-outline"
                onClick={() => setShowForm(false)}
              >
                キャンセル
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!name.trim()}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
