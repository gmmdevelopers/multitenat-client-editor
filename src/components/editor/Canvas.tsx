"use client";

import { useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RotateCcw } from "lucide-react";

import { ORGANISMS_MAP } from "@/lib/editor-registry";
import { BlockInstance } from "@/types/editor-state";
import { ViewportMode } from "./ViewportSelector";

interface CanvasProps {
  blocks: BlockInstance[];
  selectedBlockId: string | null;
  viewportMode: ViewportMode;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onSelectBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onResetBlock: (id: string) => void;
  onReorderBlocks: (activeId: string, overId: string) => void;
}

function SortableBlock({
  block,
  isSelected,
  onSelectBlock,
  onDeleteBlock,
  onResetBlock,
}: {
  block: BlockInstance;
  isSelected: boolean;
  onSelectBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onResetBlock: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const registryEntry = ORGANISMS_MAP.get(block.metaName);
  if (!registryEntry) return null;

  const Component = registryEntry.component;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelectBlock(block.id)}
      className={`group relative cursor-pointer rounded-none transition-all ${
        isSelected
          ? "ring-2 ring-amber-400 z-10"
          : "hover:ring-1 hover:ring-stone-700 hover:z-10"
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-4 top-4 z-20 flex h-7 w-7 cursor-grab items-center justify-center rounded-lg bg-black/60 text-stone-400 opacity-0 transition group-hover:opacity-100 hover:text-white active:cursor-grabbing"
        title="Arrastrar para reordenar"
      >
        ⋮⋮
      </div>

      <Component {...block.props} />

      {/* Botones de acción flotantes (Reset + Eliminar) */}
      <div className="absolute right-4 top-4 z-20 hidden gap-1.5 group-hover:flex">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onResetBlock(block.id);
          }}
          className="flex items-center gap-1 rounded-lg bg-stone-800/90 px-2.5 py-1 text-xs font-medium text-stone-300 shadow-md backdrop-blur transition hover:bg-stone-700 hover:text-white"
          title="Restablecer valores originales"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteBlock(block.id);
          }}
          className="rounded-lg bg-red-600/90 px-3 py-1 text-xs font-semibold text-white shadow-md backdrop-blur transition hover:bg-red-500"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

export function Canvas({
  blocks,
  selectedBlockId,
  viewportMode,
  zoom,
  onZoomChange,
  onSelectBlock,
  onDeleteBlock,
  onResetBlock,
  onReorderBlocks,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mantenemos la funcionalidad de zoom con la rueda del ratón (Ctrl + Scroll)
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        onZoomChange(Math.min(Math.max(zoom + delta, 0.4), 1.5));
      }
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [zoom, onZoomChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderBlocks(active.id.toString(), over.id.toString());
    }
  };

  return (
    <main
      ref={containerRef}
      className="relative flex-1 overflow-auto bg-stone-950 p-8 flex justify-center items-start"
    >
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "top center",
          transition: "transform 0.15s ease-out",
        }}
        className={`w-full flex flex-col gap-0 ${
          viewportMode === "mobile"
            ? "max-w-[375px] border-4 border-stone-800 rounded-[2.5rem] overflow-hidden bg-stone-900 shadow-2xl my-4"
            : "max-w-5xl overflow-hidden shadow-2xl"
        }`}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                isSelected={block.id === selectedBlockId}
                onSelectBlock={onSelectBlock}
                onDeleteBlock={onDeleteBlock}
                onResetBlock={onResetBlock}
              />
            ))}
          </SortableContext>
        </DndContext>

        {blocks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-stone-800 p-12 text-center text-xs text-stone-500 my-4 mx-4">
            No hay secciones agregadas. Selecciona un organismo del panel
            izquierdo para comenzar.
          </div>
        )}
      </div>
    </main>
  );
}
