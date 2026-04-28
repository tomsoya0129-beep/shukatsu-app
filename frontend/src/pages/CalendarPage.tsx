import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { calendarEvents, listCompanies } from "../api/endpoints";
import type { CalendarEvent } from "../api/types";
import { contrastText, formatDate } from "../lib/utils";
import Modal from "../components/Modal";

export default function CalendarPage() {
  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: calendarEvents,
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: listCompanies,
  });

  const [filterCompany, setFilterCompany] = useState<number | "all">("all");
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const filtered = useMemo(
    () =>
      filterCompany === "all"
        ? events
        : events.filter((e) => e.company_id === filterCompany),
    [events, filterCompany]
  );

  const fcEvents = filtered.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end || undefined,
    allDay: true,
    backgroundColor: e.color,
    borderColor: e.color,
    textColor: contrastText(e.color),
    extendedProps: e,
  }));

  const companyById = new Map(companies.map((c) => [c.id, c]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">カレンダー</h1>
          <p className="text-sm text-slate-500">
            インターン期間・締切・面接を企業色で表示します
          </p>
        </div>
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterCompany("all")}
          className={`chip ${
            filterCompany === "all"
              ? "bg-primary-600 text-white"
              : "hover:bg-slate-200"
          }`}
        >
          すべて
        </button>
        {companies.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterCompany(c.id)}
            className={`chip ${
              filterCompany === c.id
                ? "text-white ring-2 ring-offset-1"
                : "hover:bg-slate-200"
            }`}
            style={{
              background: filterCompany === c.id ? c.color : undefined,
              color: filterCompany === c.id ? contrastText(c.color) : undefined,
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: c.color }}
            />
            {c.name}
          </button>
        ))}
      </div>

      <div className="card p-2 md:p-4">
        <FullCalendar
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="ja"
          firstDay={1}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,listWeek",
          }}
          buttonText={{
            today: "今日",
            month: "月",
            week: "週",
            list: "リスト",
          }}
          height="auto"
          events={fcEvents}
          eventClick={(info) => {
            const ev = info.event.extendedProps as unknown as CalendarEvent;
            setSelected(ev);
          }}
          dayMaxEventRows={3}
        />
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? selected.title : ""}
      >
        {selected && (
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-500">種類: </span>
              <span className="font-medium">{kindLabel(selected.kind)}</span>
            </div>
            <div>
              <span className="text-slate-500">日付: </span>
              <span className="font-medium">
                {formatDate(selected.start)}
                {selected.end && selected.end !== selected.start
                  ? ` 〜 ${formatDate(adjustEnd(selected.end))}`
                  : ""}
              </span>
            </div>
            <div>
              <span className="text-slate-500">企業: </span>
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  background: companyById.get(selected.company_id)?.color,
                  color: contrastText(
                    companyById.get(selected.company_id)?.color || "#000"
                  ),
                }}
              >
                {companyById.get(selected.company_id)?.name || "-"}
              </span>
            </div>
            {"time" in selected.extra && selected.extra.time ? (
              <div>
                <span className="text-slate-500">時間: </span>
                <span className="font-medium">
                  {String(selected.extra.time)}
                </span>
              </div>
            ) : null}
            {"mode" in selected.extra && selected.extra.mode ? (
              <div>
                <span className="text-slate-500">形式: </span>
                <span className="font-medium">
                  {String(selected.extra.mode)}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}

function kindLabel(k: CalendarEvent["kind"]): string {
  switch (k) {
    case "intern_period":
      return "インターン期間";
    case "intern_deadline":
      return "インターン締切";
    case "intern_briefing":
      return "説明会";
    case "selection_deadline":
      return "本選考締切";
    case "step":
      return "選考ステップ";
    case "offer_deadline":
      return "内定承諾期限";
    case "result":
      return "結果発表";
  }
}

function adjustEnd(iso: string): string {
  // backend returns exclusive end; show inclusive
  const d = new Date(iso);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
