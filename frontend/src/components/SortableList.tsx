import { ReactNode, useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type SortableListProps<T extends { id: number }> = {
  items: T[];
  onReorder: (newIds: number[]) => void;
  renderItem: (item: T, dragHandle: ReactNode) => ReactNode;
  enabled?: boolean;
};

export function SortableList<T extends { id: number }>({
  items,
  onReorder,
  renderItem,
  enabled = true,
}: SortableListProps<T>) {
  const [order, setOrder] = useState<T[]>(items);

  useEffect(() => {
    setOrder(items);
  }, [items]);

  // Long-press / hold-to-drag (works on both desktop and touch).
  // delay=250ms so normal taps/scrolls aren't treated as drags.
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { delay: 250, tolerance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 8 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((x) => String(x.id) === String(active.id));
    const newIndex = order.findIndex((x) => String(x.id) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    onReorder(next.map((x) => x.id));
  };

  if (!enabled) {
    return (
      <>
        {items.map((it) => (
          <div key={it.id}>{renderItem(it, null)}</div>
        ))}
      </>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={order.map((x) => String(x.id))}
        strategy={verticalListSortingStrategy}
      >
        {order.map((it) => (
          <SortableRow key={it.id} id={it.id} renderItem={(handle) => renderItem(it, handle)} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  renderItem,
}: {
  id: number;
  renderItem: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(id) });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 30 : "auto",
    position: "relative",
  };

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="ドラッグして並び替え"
      className="touch-none select-none rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200"
      style={{ cursor: "grab" }}
      onClick={(e) => e.preventDefault()}
    >
      <GripVertical size={18} />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(handle)}
    </div>
  );
}
