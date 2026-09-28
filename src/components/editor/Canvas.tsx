"use client";

import { useEffect, useRef, useState } from "react";
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
import { CONNECTED_ORGANISMS } from "./connected-organisms";
import { BlockInstance } from "@/types/editor-state";
import { ViewportMode } from "./ViewportSelector";
import { pathToLocationKey, resolveFieldPath } from "@/utils/field-resolver";

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
  /** Resalta el campo del panel que corresponde al elemento clickeado. */
  onFocusField: (fieldKey: string | null) => void;
}

function SortableBlock({
  block,
  isSelected,
  onSelectBlock,
  onDeleteBlock,
  onResetBlock,
  onFocusField,
}: {
  block: BlockInstance;
  isSelected: boolean;
  onSelectBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onResetBlock: (id: string) => void;
  onFocusField: (fieldKey: string | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const rootRef = useRef<HTMLDivElement | null>(null);

  /**
   * Elemento del canvas resaltado, para dibujarle un contorno.
   *
   * Se guarda el nodo del DOM y no una prop porque el componente del design
   * system es una caja negra: no expone sus elementos internos, asi que el
   * unico modo de resaltar el `<h1>` concreto es tocar su estilo directamente.
   */
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(
    null,
  );

  /**
   * Dibuja el contorno sobre el elemento resaltado y lo quita al cambiar.
   *
   * Se aplica un `outline` (y no `border`) porque el outline NO ocupa espacio
   * en el layout: con un border, resaltar un texto desplazaria el contenido del
   * componente y el canvas daria un salto en cada click.
   *
   * `outlineOffset` separa el contorno del texto para que se lea bien en
   * elementos con padding ajustado.
   */
  useEffect(() => {
    if (!highlightedElement) return;

    const previous = {
      outline: highlightedElement.style.outline,
      outlineOffset: highlightedElement.style.outlineOffset,
      borderRadius: highlightedElement.style.borderRadius,
      transition: highlightedElement.style.transition,
    };

    highlightedElement.style.outline = "2px solid rgb(251 191 36)"; // amber-400
    highlightedElement.style.outlineOffset = "2px";
    highlightedElement.style.borderRadius = "2px";
    highlightedElement.style.transition = "outline 120ms ease-out";

    return () => {
      // Se restauran los valores ANTERIORES y no se vacian: el componente puede
      // traer sus propios estilos en linea (el hero pinta borderRadius), y
      // borrarlos le cambiaria el diseño.
      highlightedElement.style.outline = previous.outline;
      highlightedElement.style.outlineOffset = previous.outlineOffset;
      highlightedElement.style.borderRadius = previous.borderRadius;
      highlightedElement.style.transition = previous.transition;
    };
  }, [highlightedElement]);

  /**
   * El resaltado se limpia cuando este bloque deja de estar seleccionado.
   *
   * Sin esto, al seleccionar otro bloque el contorno se quedaria en el canvas
   * señalando un elemento de una seccion que ya no se esta editando.
   */
  useEffect(() => {
    if (!isSelected) setHighlightedElement(null);
  }, [isSelected]);

  // Al agregar un organismo queda seleccionado, asi que scrolleamos a el.
  //
  // No usamos `scrollIntoView`: el canvas aplica `transform: scale()` para el
  // zoom y eso rompe el calculo de posicion del navegador. Calculamos el
  // scroll a mano sobre el contenedor real.
  //
  // El efecto no lleva cleanup ni flag de "ya scrolleado": en StrictMode
  // React monta, desmonta y remonta, y un cleanup cancelando el rAF dejaba
  // el scroll sin ejecutar. Scroll a la posicion correcta es idempotente, asi
  // que repetirlo es inofensivo, y solo corre cuando `isSelected` cambia.
  useEffect(() => {
    if (!isSelected) return;

    const element = rootRef.current;
    if (!element) return;

    const frame = requestAnimationFrame(() => {
      const scroller = element.closest("main");
      if (!scroller) return;

      const blockRect = element.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();

      const alreadyVisible =
        blockRect.top >= scrollerRect.top && blockRect.bottom <= scrollerRect.bottom;

      if (alreadyVisible) return;

      // Centramos el bloque en el viewport del canvas, sin dejar hueco arriba.
      const target =
        scroller.scrollTop +
        (blockRect.top - scrollerRect.top) -
        (scrollerRect.height - blockRect.height) / 2;

      scroller.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    });

    return () => cancelAnimationFrame(frame);
  }, [isSelected]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const registryEntry = ORGANISMS_MAP.get(block.metaName);
  if (!registryEntry) return null;

  // Algunos organismos necesitan logica de cliente (la agenda habla con la
  // API). Si existe una version conectada, esa gana sobre la del design system.
  const Component =
    CONNECTED_ORGANISMS[block.metaName] ?? registryEntry.component;

  /**
   * Click en el bloque: selecciona, resalta el elemento pulsado y enfoca su
   * campo en el panel de propiedades.
   *
   * Se usa el elemento REAL del click (`event.target`) y no el bloque: el
   * cliente puede haber pulsado el `<h1>` del titulo o un `<p>` de la
   * descripcion, y cada uno corresponde a una prop distinta.
   *
   * Los botones flotantes (arrastrar, reset, eliminar) ya hacen
   * `stopPropagation`, asi que no llegan aqui.
   */
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // En modo edicion, un enlace o boton del componente NO debe navegar ni
    // disparar su accion: el cliente esta editando, no usando el sitio. Sin
    // esto, pulsar el CTA del hero lo sacaba del editor a la pagina de destino.
    //
    // Se cancela ANTES de nada para que ningun handler del componente llegue a
    // ejecutarse: el objetivo del click es seleccionar, no navegar.
    const interactive = (event.target as HTMLElement | null)?.closest(
      "a, button, [role='button']",
    );

    if (interactive) {
      event.preventDefault();
      event.stopPropagation();
    }

    onSelectBlock(block.id);

    const target = event.target as HTMLElement | null;

    // El propio contenedor del bloque (el anillo de seleccion) no es un campo:
    // pulsarlo solo selecciona, sin resaltar nada.
    if (!target || target === event.currentTarget) {
      setHighlightedElement(null);
      onFocusField(null);
      return;
    }

    // Para un enlace o boton, el texto util no esta en el elemento pulsado
    // (que puede ser un `<span>` interno): se sube al contenedor interactivo,
    // cuyo `textContent` es el que el cliente ve y el que corresponde a la prop
    // de la etiqueta (`primaryCtaLabel`).
    const fieldTarget = (interactive ?? target) as HTMLElement;
    const path = resolveFieldPath(fieldTarget, block);

    // El resaltado del canvas sigue al mismo elemento que se enfoca en el
    // panel: si el resolver no encontro prop, no se resalta nada, para que las
    // dos vistas no digan cosas distintas.
    setHighlightedElement(path ? fieldTarget : null);

    onFocusField(path ? pathToLocationKey(path) : null);
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        rootRef.current = node;
      }}
      style={style}
      onClick={handleClick}
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
  onFocusField,
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
      className="relative min-h-0 flex-1 overflow-y-auto bg-stone-950 p-8 flex justify-center items-start"
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
                onFocusField={onFocusField}
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
