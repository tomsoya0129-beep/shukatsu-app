import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { Book, BookUnit } from "../types";

const BOOK_TYPES = [
  { value: "chapter_based", label: "章・セクション形式" },
  { value: "problem_based", label: "問題番号形式" },
  { value: "page_based", label: "ページ範囲形式" },
];

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [editing, setEditing] = useState<Book | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadBooks = async () => {
    setLoading(true);
    const data = await api.get<Book[]>("/api/books");
    setBooks(data);
    setLoading(false);
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleEdit = (book: Book) => {
    setEditing(book);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この参考書を削除しますか？")) return;
    await api.del(`/api/books/${id}`);
    loadBooks();
  };

  const handleSave = async () => {
    setShowForm(false);
    setEditing(null);
    loadBooks();
  };

  return (
    <div>
      <div className="flex-between mb-2">
        <h2>参考書ライブラリ</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + 参考書を追加
        </button>
      </div>

      {loading ? (
        <div className="empty-state">読み込み中...</div>
      ) : books.length === 0 ? (
        <div className="card empty-state">
          参考書がありません。「参考書を追加」ボタンから追加してください。
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>参考書名</th>
                <th>タイプ</th>
                <th>単元数</th>
                <th>総ページ数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>{b.name}</td>
                  <td>
                    {BOOK_TYPES.find((t) => t.value === b.book_type)?.label}
                  </td>
                  <td>{b.units.length}</td>
                  <td>{b.total_pages || "—"}</td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleEdit(b)}
                      style={{ marginRight: "0.3rem" }}
                    >
                      編集
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(b.id)}
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
        <BookFormModal
          book={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

interface BookFormModalProps {
  book: Book | null;
  onClose: () => void;
  onSave: () => void;
}

function BookFormModal({ book, onClose, onSave }: BookFormModalProps) {
  const [name, setName] = useState(book?.name || "");
  const [bookType, setBookType] = useState(book?.book_type || "chapter_based");
  const [totalPages, setTotalPages] = useState<string>(
    book?.total_pages?.toString() || ""
  );
  const [units, setUnits] = useState<BookUnit[]>(book?.units || []);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);

  // Quick add for problem-based
  const [problemStart, setProblemStart] = useState("1");
  const [problemEnd, setProblemEnd] = useState("70");
  const [problemPrefix, setProblemPrefix] = useState("第");
  const [problemSuffix, setProblemSuffix] = useState("章");

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const data = {
      name: name.trim(),
      book_type: bookType,
      total_pages: totalPages ? parseInt(totalPages) : null,
      units: units.map((u, i) => ({ ...u, sort_order: i })),
    };
    if (book) {
      await api.put(`/api/books/${book.id}`, data);
    } else {
      await api.post("/api/books", data);
    }
    setSaving(false);
    onSave();
  };

  const addUnit = () => {
    setUnits([
      ...units,
      {
        label: "",
        title: "",
        sort_order: units.length,
      },
    ]);
  };

  const updateUnit = (index: number, field: keyof BookUnit, value: string | number | undefined) => {
    const newUnits = [...units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setUnits(newUnits);
  };

  const removeUnit = (index: number) => {
    setUnits(units.filter((_, i) => i !== index));
  };

  const generateProblems = () => {
    const start = parseInt(problemStart);
    const end = parseInt(problemEnd);
    if (isNaN(start) || isNaN(end) || start > end) return;
    const newUnits: BookUnit[] = [];
    for (let i = start; i <= end; i++) {
      newUnits.push({
        label: `${problemPrefix}${i}${problemSuffix}`,
        sort_order: i - start,
      });
    }
    setUnits(newUnits);
  };

  const parseBulkText = () => {
    const lines = bulkText.split("\n").filter((l) => l.trim());
    const parsed: BookUnit[] = [];
    let currentParent = "";
    let order = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      // Try to detect section headers (e.g., "第1編 力と運動")
      const sectionMatch = trimmed.match(/^(第\d+編)\s+(.+)$/);
      if (sectionMatch) {
        currentParent = `${sectionMatch[1]} ${sectionMatch[2]}`;
        continue;
      }

      // Try to detect chapter lines with page numbers
      // Patterns:
      // "第1章 平面内の運動 2" or "第1章　平面内の運動　2"
      // "Sec 7" or "Sec7"
      const chapterMatch = trimmed.match(
        /^(第?\d+章?|Sec\s*\d+|[A-Za-z]+\s*\d+)\s+(.+?)[\s　]+(\d+)\s*$/
      );
      if (chapterMatch) {
        parsed.push({
          label: chapterMatch[1],
          title: chapterMatch[2],
          start_page: parseInt(chapterMatch[3]),
          sort_order: order++,
          parent_label: currentParent || undefined,
        });
        continue;
      }

      // Simple label with page: "第1章 2" or "1 平面内の運動"
      const simpleMatch = trimmed.match(/^(.+?)[\s　]+(\d+)\s*$/);
      if (simpleMatch) {
        const label = simpleMatch[1].trim();
        const page = parseInt(simpleMatch[2]);
        // Check if label looks like a chapter/section
        const labelParts = label.match(/^(第?\d+章?|Sec\s*\d+)\s*(.*)$/);
        if (labelParts) {
          parsed.push({
            label: labelParts[1],
            title: labelParts[2] || undefined,
            start_page: page,
            sort_order: order++,
            parent_label: currentParent || undefined,
          });
        } else {
          parsed.push({
            label: label,
            start_page: page,
            sort_order: order++,
            parent_label: currentParent || undefined,
          });
        }
        continue;
      }

      // Just a label
      if (trimmed) {
        parsed.push({
          label: trimmed,
          sort_order: order++,
          parent_label: currentParent || undefined,
        });
      }
    }

    // Calculate end_page from next unit's start_page
    for (let i = 0; i < parsed.length - 1; i++) {
      if (parsed[i].start_page && parsed[i + 1].start_page) {
        parsed[i].end_page = parsed[i + 1].start_page! - 1;
      }
    }
    if (parsed.length > 0 && totalPages) {
      const last = parsed[parsed.length - 1];
      if (last.start_page) {
        last.end_page = parseInt(totalPages);
      }
    }

    setUnits(parsed);
    setBulkMode(false);
    setBulkText("");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{book ? "参考書を編集" : "参考書を追加"}</h2>

        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label>参考書名</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：セミナー物理"
            />
          </div>
          <div className="form-group">
            <label>タイプ</label>
            <select value={bookType} onChange={(e) => setBookType(e.target.value)}>
              {BOOK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 0.5 }}>
            <label>総ページ数</label>
            <input
              type="number"
              value={totalPages}
              onChange={(e) => setTotalPages(e.target.value)}
              placeholder="任意"
            />
          </div>
        </div>

        <div className="flex-between mt-2 mb-1">
          <h3 style={{ fontSize: "1rem" }}>目次・単元一覧 ({units.length}件)</h3>
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" onClick={() => setBulkMode(!bulkMode)}>
              {bulkMode ? "個別入力に戻す" : "一括入力"}
            </button>
            {bookType === "problem_based" && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const modal = document.getElementById("problem-gen");
                  if (modal) modal.style.display = modal.style.display === "none" ? "block" : "none";
                }}
              >
                連番生成
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={addUnit}>
              + 単元追加
            </button>
          </div>
        </div>

        {/* Problem number generator */}
        <div
          id="problem-gen"
          style={{ display: "none" }}
          className="units-editor mb-1"
        >
          <div className="form-row">
            <div className="form-group">
              <label>接頭辞</label>
              <input value={problemPrefix} onChange={(e) => setProblemPrefix(e.target.value)} />
            </div>
            <div className="form-group">
              <label>開始番号</label>
              <input
                type="number"
                value={problemStart}
                onChange={(e) => setProblemStart(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>終了番号</label>
              <input
                type="number"
                value={problemEnd}
                onChange={(e) => setProblemEnd(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>接尾辞</label>
              <input value={problemSuffix} onChange={(e) => setProblemSuffix(e.target.value)} />
            </div>
            <div className="form-group">
              <label>&nbsp;</label>
              <button className="btn btn-primary btn-sm" onClick={generateProblems}>
                生成
              </button>
            </div>
          </div>
          <p className="help-text">
            例：接頭辞「第」開始1 終了70 接尾辞「章」→ 第1章〜第70章
          </p>
        </div>

        {bulkMode ? (
          <div className="units-editor">
            <p className="help-text mb-1">
              目次をそのまま貼り付けてください。各行を自動的にパースします。
              <br />
              対応形式：「第1章 平面内の運動 2」「第1編 力と運動」（セクションヘッダ）
              <br />
              ページ番号は行末の数字として認識されます。
            </p>
            <textarea
              className="bulk-input-area"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`例:\n第1編 力と運動\n第1章 平面内の運動 2\n第2章 剛体にはたらく力のつりあい 8\n第3章 運動量の保存 16`}
              rows={12}
            />
            <div className="mt-1">
              <button className="btn btn-primary" onClick={parseBulkText}>
                パースして反映
              </button>
            </div>
          </div>
        ) : (
          <div
            className="units-editor"
            style={{ maxHeight: "300px", overflowY: "auto" }}
          >
            {units.length === 0 ? (
              <p className="help-text">
                単元がありません。「+ 単元追加」「一括入力」「連番生成」から追加してください。
              </p>
            ) : (
              units.map((u, i) => (
                <div className="unit-row" key={i}>
                  <span className="unit-num">{i + 1}</span>
                  <input
                    style={{ width: "120px" }}
                    value={u.label}
                    onChange={(e) => updateUnit(i, "label", e.target.value)}
                    placeholder="ラベル (第1章)"
                  />
                  <input
                    style={{ width: "180px" }}
                    value={u.title || ""}
                    onChange={(e) => updateUnit(i, "title", e.target.value)}
                    placeholder="タイトル (任意)"
                  />
                  <input
                    type="number"
                    style={{ width: "70px" }}
                    value={u.start_page || ""}
                    onChange={(e) =>
                      updateUnit(i, "start_page", e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    placeholder="開始p"
                  />
                  <input
                    type="number"
                    style={{ width: "70px" }}
                    value={u.end_page || ""}
                    onChange={(e) =>
                      updateUnit(i, "end_page", e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    placeholder="終了p"
                  />
                  <input
                    style={{ width: "130px" }}
                    value={u.parent_label || ""}
                    onChange={(e) => updateUnit(i, "parent_label", e.target.value)}
                    placeholder="親セクション"
                  />
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => removeUnit(i)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex-between mt-2">
          <button className="btn btn-outline" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
