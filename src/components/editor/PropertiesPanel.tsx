"use client";

import { useState } from "react";
import { BlockInstance } from "@/types/editor-state";
import { ORGANISMS_MAP } from "@/lib/editor-registry";
import { useEditorStore } from "@/hooks/useEditorStore";
import {
  Trash2,
  Plus,
  Palette,
  Smile,
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { isColorProp, isIconProp, isLinkProp } from "@/utils/InputsTypeHelper";

interface PropertiesPanelProps {
  selectedBlock: BlockInstance | undefined;
  onUpdateProp: (blockId: string, propName: string, value: any) => void;
}

/** Un bloque puede llegar de la API sin `props`; nunca asumimos su forma. */
function safeProps(block: BlockInstance): Record<string, any> {
  return block.props && typeof block.props === "object" ? block.props : {};
}

const POPULAR_ICONS = [
  "Heart",
  "Star",
  "User",
  "Phone",
  "Mail",
  "Calendar",
  "MapPin",
  "Check",
  "X",
  "ArrowRight",
  "Shield",
  "Bell",
  "Search",
  "Settings",
  "Activity",
  "Stethoscope",
];

const PRESET_COLORS = [
  "#f59e0b",
  "#06b6d4",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#8b5cf6",
  "#1c1917",
  "#ffffff",
];

// Páginas estáticas / creadas con el editor
const STATIC_PAGES = [
  { label: "Inicio (Home)", value: "/" },
  { label: "Blog", value: "/blog" },
  { label: "Contacto", value: "/contacto" },
  { label: "Servicios", value: "/servicios" },
  { label: "Nosotros", value: "/nosotros" },
];

export function PropertiesPanel({
  selectedBlock,
  onUpdateProp,
}: PropertiesPanelProps) {
  const [collapsedLists, setCollapsedLists] = useState<Record<string, boolean>>(
    {},
  );
  const [activeIconProp, setActiveIconProp] = useState<{
    propName: string;
  } | null>(null);

  // Obtenemos los bloques del lienzo para generar las anclas de sección
  const blocks = useEditorStore((state) => state.blocks);

  if (!selectedBlock) {
    return (
      <aside className="w-80 border-l border-stone-800 bg-stone-900/50 p-6 flex flex-col items-center justify-center text-center">
        <div className="rounded-full bg-stone-800/80 p-3 text-stone-500 mb-3">
          🎨
        </div>
        <p className="text-xs font-medium text-stone-400">
          Selecciona una sección del lienzo para editar sus propiedades.
        </p>
      </aside>
    );
  }

  const registryEntry = ORGANISMS_MAP.get(selectedBlock.metaName);
  const props = safeProps(selectedBlock);

  const toggleListCollapse = (propName: string) => {
    setCollapsedLists((prev) => ({
      ...prev,
      [propName]: !prev[propName],
    }));
  };

  const handleArrayItemChange = (
    propName: string,
    index: number,
    itemKey: string,
    value: any,
  ) => {
    const currentArray = [...(props[propName] || [])];
    if (
      typeof currentArray[index] === "object" &&
      currentArray[index] !== null
    ) {
      currentArray[index] = {
        ...currentArray[index],
        [itemKey]: value,
      };
    } else {
      currentArray[index] = value;
    }
    onUpdateProp(selectedBlock.id, propName, currentArray);
  };

  const handleAddArrayItem = (propName: string) => {
    const currentArray = [...(props[propName] || [])];
    const templateItem =
      currentArray.length > 0 && typeof currentArray[0] === "object"
        ? Object.keys(currentArray[0]).reduce(
            (acc, key) => {
              acc[key] = isIconProp(key) ? "Heart" : isLinkProp(key) ? "#" : "";
              return acc;
            },
            {} as Record<string, any>,
          )
        : "Nuevo Item";

    if (collapsedLists[propName]) {
      toggleListCollapse(propName);
    }

    onUpdateProp(selectedBlock.id, propName, [...currentArray, templateItem]);
  };

  const handleRemoveArrayItem = (propName: string, index: number) => {
    const currentArray = [...(props[propName] || [])];
    currentArray.splice(index, 1);
    onUpdateProp(selectedBlock.id, propName, currentArray);
  };

  /**
   * Envuelve el contenido de un campo con una `key` unica.
   *
   * `renderFieldContent` devuelve un elemento suelto y se invoca en bucles
   * (props del bloque, items de un array, sub-campos de un item), asi que
   * cada llamada necesita su propia key para que React no avise por listas
   * sin key estable.
   */
  const renderSingleField = (
    key: string,
    value: any,
    onChange: (newValue: any) => void,
    locationKey: string,
  ) => (
    <div key={locationKey} className="flex flex-col">
      {renderFieldContent(key, value, onChange, locationKey)}
    </div>
  );

  const renderFieldContent = (
    key: string,
    value: any,
    onChange: (newValue: any) => void,
    locationKey: string,
  ) => {
    // 1. Selector de Enlaces (HREF / URL / LINK)
    if (isLinkProp(key)) {
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium text-stone-400 capitalize flex items-center justify-between">
            <span>{key}</span>
            <LinkIcon className="h-3 w-3 text-stone-500" />
          </label>

          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-200 outline-none focus:border-amber-400 cursor-pointer"
          >
            <optgroup label="Secciones de este Canvas">
              {blocks.map((block, i) => {
                const name =
                  ORGANISMS_MAP.get(block.metaName)?.component?.displayName ||
                  block.metaName;
                const anchor = `#${block.metaName.toLowerCase()}-${block.id.slice(0, 4)}`;
                return (
                  <option key={block.id} value={anchor}>
                    # {i + 1}. {name}
                  </option>
                );
              })}
            </optgroup>

            <optgroup label="Páginas del Sitio / Aplicación">
              {STATIC_PAGES.map((page) => (
                <option key={page.value} value={page.value}>
                  {page.label} ({page.value})
                </option>
              ))}
            </optgroup>
          </select>

          {/* Campo manual para URLs externas o enlaces personalizados */}
          <input
            type="text"
            placeholder="O escribe una URL manual (https://...)"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-stone-800/60 bg-stone-950/60 px-2 py-1 text-[11px] text-stone-400 outline-none focus:border-amber-400 placeholder:text-stone-600"
          />
        </div>
      );
    }

    // 2. Selector de Iconos
    if (isIconProp(key)) {
      const IconComponent =
        (LucideIcons as any)[value] || LucideIcons.HelpCircle;
      const isOpen = activeIconProp?.propName === locationKey;

      return (
        <div className="flex flex-col gap-1 relative">
          <label className="text-[10px] font-medium text-stone-400 capitalize">
            {key}
          </label>
          <button
            type="button"
            onClick={() =>
              setActiveIconProp(isOpen ? null : { propName: locationKey })
            }
            className="flex items-center justify-between gap-2 rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-200 hover:border-stone-700"
          >
            <div className="flex items-center gap-2">
              <IconComponent className="h-4 w-4 text-amber-400" />
              <span>{value || "Seleccionar icono"}</span>
            </div>
            <Smile className="h-3.5 w-3.5 text-stone-500" />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 z-30 mt-1 w-full rounded-xl border border-stone-800 bg-stone-900 p-2 shadow-xl grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
              {POPULAR_ICONS.map((iconName) => {
                const ItemIcon = (LucideIcons as any)[iconName];
                if (!ItemIcon) return null;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => {
                      onChange(iconName);
                      setActiveIconProp(null);
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg hover:bg-stone-800 transition ${
                      value === iconName
                        ? "bg-amber-400/10 text-amber-300 border border-amber-400/30"
                        : "text-stone-400"
                    }`}
                    title={iconName}
                  >
                    <ItemIcon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // 3. Control de Color
    if (isColorProp(key, value)) {
      const colorValue = typeof value === "string" ? value : "";
      const hexColor = colorValue.startsWith("#") ? colorValue : "#000000";

      return (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-stone-400 capitalize flex items-center justify-between">
            <span>{key}</span>
            <Palette className="h-3 w-3 text-stone-500" />
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={hexColor}
              onChange={(e) => onChange(e.target.value)}
              className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <input
              type="text"
              value={String(value ?? "")}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1 text-xs text-stone-200 outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex gap-1 mt-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                style={{ backgroundColor: c }}
                className="h-3.5 w-3.5 rounded-full border border-stone-700 transition hover:scale-110"
              />
            ))}
          </div>
        </div>
      );
    }

    // 4. Booleano
    if (typeof value === "boolean") {
      return (
        <div className="flex items-center justify-between py-1">
          <label className="text-xs font-medium capitalize text-stone-300">
            {key}
          </label>
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-stone-700 bg-stone-800 text-amber-400 focus:ring-amber-400"
          />
        </div>
      );
    }

    // 5. Input Estándar
    return (
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium text-stone-400">
          {fieldLabels.get(key) ?? key}
        </label>
        <input
          type={typeof value === "number" ? "number" : "text"}
          value={String(value ?? "")}
          onChange={(e) =>
            onChange(
              typeof value === "number"
                ? Number(e.target.value)
                : e.target.value,
            )
          }
          className="w-full rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1 text-xs text-stone-200 outline-none focus:border-amber-400"
        />
      </div>
    );
  };

  // El editor debe mostrar las etiquetas del meta, no el nombre crudo de la
  // prop: un campo `heroDescription` se lee mejor como "Hero description".
  // Los metas nuevos declaran sus campos en `groups`, asi que aplanamos
  // fields + groups en un mapa propName -> label.
  const fieldLabels = new Map<string, string>();
  const meta = registryEntry?.meta;

  const collectLabels = (
    fields: readonly { name: string; label: string }[] | undefined,
  ) => {
    for (const field of fields ?? []) fieldLabels.set(field.name, field.label);
  };

  collectLabels(meta?.fields);
  for (const group of meta?.groups ?? []) collectLabels(group.fields);

  return (
    <aside className="w-80 border-l border-stone-800 bg-stone-900/50 p-4 overflow-y-auto">
      <div className="mb-4 border-b border-stone-800 pb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
          Editando
        </span>
        <h2 className="text-sm font-bold text-white">
          {registryEntry?.component?.displayName || selectedBlock.metaName}
        </h2>
      </div>

      <div className="flex flex-col gap-5">
        {Object.entries(props).map(([propName, propValue]) => {
          if (Array.isArray(propValue)) {
            const isCollapsed = !!collapsedLists[propName];

            return (
              <div
                key={propName}
                className="flex flex-col gap-2 rounded-xl border border-stone-800 bg-stone-950/50 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-stone-300">
                      {fieldLabels.get(propName) ?? propName}
                    </label>
                    <span className="rounded-full bg-stone-800 px-1.5 py-0.2 text-[10px] text-stone-400">
                      {propValue.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAddArrayItem(propName)}
                      className="flex items-center gap-1 rounded-md bg-stone-800 px-2 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-stone-700"
                    >
                      <Plus className="h-3 w-3" /> Añadir
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleListCollapse(propName)}
                      className="rounded-md p-1 text-stone-400 hover:bg-stone-800 hover:text-white transition"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="flex flex-col gap-3 mt-1">
                    {propValue.map((item, index) => (
                      <div
                        key={index}
                        className="relative flex flex-col gap-2 rounded-lg border border-stone-800/80 bg-stone-900 p-2.5"
                      >
                        <div className="flex items-center justify-between border-b border-stone-800 pb-1">
                          <span className="text-[10px] font-bold text-stone-500">
                            #{index + 1}
                          </span>
                          <button
                            onClick={() =>
                              handleRemoveArrayItem(propName, index)
                            }
                            className="text-stone-500 hover:text-red-400"
                            title="Eliminar ítem"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>

                        {typeof item === "object" && item !== null
                          ? Object.entries(item).map(([subKey, subValue]) =>
                              renderSingleField(
                                subKey,
                                subValue,
                                (newValue) =>
                                  handleArrayItemChange(
                                    propName,
                                    index,
                                    subKey,
                                    newValue,
                                  ),
                                `${propName}-${index}-${subKey}`,
                              ),
                            )
                          : renderSingleField(
                              propName,
                              item,
                              (newValue) =>
                                handleArrayItemChange(
                                  propName,
                                  index,
                                  "",
                                  newValue,
                                ),
                              `${propName}-${index}`,
                            )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return renderSingleField(
            propName,
            propValue,
            (newValue) => onUpdateProp(selectedBlock.id, propName, newValue),
            propName,
          );
        })}
      </div>
    </aside>
  );
}
