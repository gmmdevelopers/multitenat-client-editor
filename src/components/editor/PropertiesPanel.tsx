"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BlockInstance } from "@/types/editor-state";
import { ALL_BLOCKS_MAP } from "@/lib/editor-registry";
import { blockAnchorHref } from "@/lib/anchor";
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
import { BUSINESS_ICONS, BUSINESS_ICON_COMPONENTS } from "@multitenant/design-system";
import { isColorProp, isIconProp, isImageProp, isLinkProp } from "@/utils/InputsTypeHelper";
import { ImagePickerModal } from "./ImagePickerModal";
import { NestedList } from "./NestedList";
/**
 * Los iconos que el panel sabe RESOLVER, y solo esos.
 *
 * ## Por que no los sets completos
 *
 * Antes juntaba `lucide` + `simple-icons` + `font-awesome` enteros. Eso funcionaba
 * para mostrar el icono elegido, pero tenia dos costes:
 *
 *   1. **Inlineaba las tres librerias en el bundle del editor** (~5 MB), y
 *   2. ofrecia iconos que la web **no puede pintar**: el panel los resolvia aqui
 *      mismo, pero `DynamicIcon` ya no los conoce, asi que la pagina salia sin
 *      icono aunque el editor lo mostrara.
 *
 * Ahora la lista de marca es `BUSINESS_ICONS`, la MISMA que usa `DynamicIcon`. Si
 * el panel resuelve un icono, la web tambien.
 *
 * Lucide se queda completo porque hace tree-shaking: el resultado del build solo
 * incluye los que se usan.
 */
const ALL_ICONS: Record<string, any> = {
  ...(LucideIcons as any),
  ...BUSINESS_ICON_COMPONENTS,
};

interface PropertiesPanelProps {
  selectedBlock: BlockInstance | undefined;
  onUpdateProp: (blockId: string, propName: string, value: any) => void;
}

/** Un bloque puede llegar de la API sin `props`; nunca asumimos su forma. */
function safeProps(block: BlockInstance): Record<string, any> {
  return block.props && typeof block.props === "object" ? block.props : {};
}

/**
 * Los iconos de interfaz de Lucide, sin duplicados.
 *
 * ## Por que hay que deduplicar
 *
 * `lucide-react` exporta cada icono **tres veces**: `Newspaper`,
 * `NewspaperIcon` y `LucideNewspaper`. Son 6.356 exports para ~2.100 iconos, y
 * en el selector salian como tres opciones distintas que hacen lo mismo.
 *
 * Se queda solo la forma corta (`Newspaper`): es la que guardan los bloques y la
 * que `DynamicIcon` resuelve.
 */
const LUCIDE_ICON_NAMES: string[] = Object.keys(LucideIcons).filter(
  (name) =>
    /^[A-Z]/.test(name) &&
    !name.endsWith("Icon") &&
    !name.startsWith("Lucide"),
);

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
  /**
   * Redes sociales: se derivan de `BUSINESS_ICONS`, que es la lista que la web
   * sabe pintar. Estaban escritos a mano y uno de ellos (`FaXTwitter`) no existe
   * en esa lista: elegirlo dejaba el enlace sin icono en la pagina publicada,
   * aunque el editor lo mostrara.
   */
  ...BUSINESS_ICONS.map((icon) => icon.name),
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

  /**
   * Texto del buscador del selector de icono.
   *
   * Se limpia al elegir y al abrir otro campo: si se quedara, el siguiente
   * campo de icono abriria ya filtrado por lo que se busco antes.
   */
  const [iconSearch, setIconSearch] = useState("");

  /**
   * Los iconos que se muestran en el selector, ya filtrados.
   *
   * Sin busqueda son los `POPULAR_ICONS` (una rejilla corta y reconocible).
   * Con busqueda se recorre **todo** lo que `ALL_ICONS` conoce, para que el
   * cliente pueda llegar a un icono que no esta en la lista corta.
   */
  const iconOptions = useMemo(() => {
    const query = iconSearch
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    if (!query) return POPULAR_ICONS;

    /**
     * La busqueda mira tres cosas: el nombre tecnico, la etiqueta en espanol y
     * las palabras clave. Buscar solo el nombre hacia que "cara" no encontrara
     * Facebook y "wsp" no encontrara WhatsApp.
     */
    const labelFor = (name: string) =>
      BUSINESS_ICONS.find((icon) => icon.name === name)?.label ?? name;

    const keywordsFor = (name: string) =>
      BUSINESS_ICONS.find((icon) => icon.name === name)?.keywords ?? [];

    /**
     * Traducciones de los iconos de interfaz que mas se buscan en espanol.
     *
     * Lucide solo tiene nombres en ingles: "flecha" no encontraba `ArrowRight`
     * porque la palabra no aparece en ningun sitio. Es una lista corta y de los
     * casos frecuentes, no un diccionario.
     */
    const SPANISH: Record<string, string[]> = {
      ArrowRight: ["flecha", "derecha", "siguiente"],
      ArrowLeft: ["flecha", "izquierda", "atras"],
      ArrowUp: ["flecha", "arriba"],
      ArrowDown: ["flecha", "abajo"],
      Phone: ["telefono", "llamar", "contacto"],
      Mail: ["correo", "email", "sobre", "contacto"],
      MapPin: ["ubicacion", "mapa", "direccion"],
      Calendar: ["calendario", "fecha", "agenda", "cita"],
      Clock: ["reloj", "hora", "horario"],
      Check: ["check", "tache", "listo", "ok", "correcto"],
      X: ["cerrar", "equis", "cancelar"],
      Heart: ["corazon", "favorito", "me gusta"],
      Star: ["estrella", "favorito", "valoracion"],
      User: ["usuario", "persona", "perfil"],
      Users: ["usuarios", "personas", "equipo"],
      Search: ["buscar", "lupa"],
      Settings: ["ajustes", "configuracion", "engranaje"],
      Shield: ["escudo", "seguridad", "proteccion"],
      Stethoscope: ["estetoscopio", "medico", "salud"],
      Activity: ["actividad", "pulso", "salud"],
      Scissors: ["tijera", "corte", "barberia"],
      Sparkles: ["brillo", "destellos", "estetica"],
      Smile: ["sonrisa", "feliz", "cara"],
      Building: ["edificio", "empresa", "negocio"],
      Home: ["inicio", "casa"],
      MessageCircle: ["mensaje", "chat", "conversacion"],
      Award: ["premio", "medalla", "logro"],
      GraduationCap: ["estudios", "titulo", "educacion"],
    };

    const lucideKeywords = (name: string) => SPANISH[name] ?? [];

    /**
     * Se buscan los DOS grupos.
     *
     * Antes solo recorria `LUCIDE_ICON_NAMES`, asi que escribir "whatsapp"
     * devolvia **cero resultados** aunque el icono exista y este en la rejilla: es
     * una marca, y las marcas no son de Lucide.
     */
    const matches = (texts: string[]) =>
      texts
        .map((text) =>
          text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        )
        .some((text) => text.includes(query));

    /** Cuantas coincidencias empiezan por el texto buscado. */
    const prefixScore = (texts: string[]) =>
      texts.filter((text) =>
        text
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .startsWith(query),
      ).length;

    /**
     * Prioridad de los resultados.
     *
     * Buscar por subcadena es comodo pero llena la lista de ruido: "wsp"
     * encontraba `Newspaper` (por la `wsp` de "ne**wsp**aper") y "cara" encontraba
     * `Caravan`. Se sigue mostrando todo (a veces el ruido es util), pero **arriba
     * queda lo que empieza por lo buscado**, que es casi siempre lo que se queria.
     *
     * Las marcas van antes que Lucide porque es lo que mas se busca en una ficha
     * de negocio.
     */
    const scored: { name: string; score: number }[] = [];

    BUSINESS_ICONS.forEach((icon, index) => {
      const texts = [icon.name, icon.label, ...(icon.keywords ?? [])];
      if (!matches(texts)) return;

      // 100 de base: cualquier marca va antes que un icono de interfaz.
      scored.push({ name: icon.name, score: 1000 - index * 10 - (prefixScore(texts) ? 0 : 5) });
    });

    LUCIDE_ICON_NAMES.forEach((name) => {
      if (!ALL_ICONS[name]) return;

      const texts = [name, labelFor(name), ...keywordsFor(name), ...lucideKeywords(name)];
      if (!matches(texts)) return;

      scored.push({ name, score: prefixScore(texts) ? 100 : 10 });
    });

    return scored.sort((a, b) => b.score - a.score).map((entry) => entry.name);
  }, [iconSearch]);
  /**
   * Campo de imagen con el selector abierto (`locationKey`).
   *
   * Se guarda la clave y no la prop: el campo puede estar dentro de un item de
   * array (`images-0-src`), y al elegir hay que actualizar ESE item.
   */
  const [imagePickerField, setImagePickerField] = useState<string | null>(null);

  // Obtenemos los bloques del lienzo para generar las anclas de sección
  const blocks = useEditorStore((state) => state.blocks);
  const focusedFieldKey = useEditorStore((state) => state.focusedFieldKey);
  const focusRequestId = useEditorStore((state) => state.focusRequestId);

  const panelRef = useRef<HTMLElement | null>(null);

  /**
   * Resalta y scrollea hasta el input del campo pulsado en el canvas.
   *
   * Se ejecuta con `focusRequestId` (y no con `focusedFieldKey`) para que un
   * segundo click sobre el MISMO texto vuelva a scrollear: si dependiera solo
   * del nombre del campo, repetir el click no cambiaria nada y no habria
   * scroll.
   *
   * El desplazamiento se calcula a mano sobre el contenedor del panel. No se
   * usa `scrollIntoView` porque desplazaria tambien el canvas: los dos paneles
   * comparten el scroll de la pagina y el bloque seleccionado se saldria de
   * vista.
   *
   * Se reintenta en varios frames porque el panel y sus campos pueden no estar
   * montados todavia: el cliente puede hacer click en un texto de un bloque que
   * aun no estaba seleccionado, y en ese render el `<aside>` del panel de
   * propiedades se acaba de crear. Un unico `requestAnimationFrame` corria
   * antes de que el DOM tuviera el input, y el scroll se perdia en silencio.
   */
  useEffect(() => {
    if (!focusedFieldKey) return;

    let frame = 0;
    let attempts = 0;

    const MAX_ATTEMPTS = 20; // ~330 ms a 60 fps

    const tryScroll = () => {
      const panel = panelRef.current;
      const input = panel?.querySelector<HTMLElement>(
        `[data-field-key="${CSS.escape(focusedFieldKey)}"]`,
      );

      if (!panel || !input) {
        // El panel aun no esta listo; se reintenta en el siguiente frame.
        if (attempts < MAX_ATTEMPTS) {
          attempts += 1;
          frame = requestAnimationFrame(tryScroll);
        }
        return;
      }

      const panelRect = panel.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();

      const isVisible =
        inputRect.top >= panelRect.top && inputRect.bottom <= panelRect.bottom;

      if (isVisible) return;

      // Se centra el campo en el panel, sin pasarse del principio ni del final.
      const target =
        panel.scrollTop +
        (inputRect.top - panelRect.top) -
        (panelRect.height - inputRect.height) / 2;

      panel.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    };

    frame = requestAnimationFrame(tryScroll);

    return () => cancelAnimationFrame(frame);
  }, [focusedFieldKey, focusRequestId]);

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

  // `ALL_BLOCKS_MAP` y no `ORGANISMS_MAP`: el bloque seleccionado puede ser una
  // UTILIDAD (el boton de WhatsApp), que vive en otra categoria. Con el mapa de
  // organismos, `registryEntry` quedaba `undefined` para esos bloques y el panel
  // no tenia de donde sacar las etiquetas de los campos.
  const registryEntry = ALL_BLOCKS_MAP.get(selectedBlock.metaName);
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

  /**
   * Cambia un campo de un item de una lista ANIDADA (lista dentro de un item).
   *
   * `outerPath` es la ruta hasta la lista contenedora (`members`), `outerIndex`
   * el item dentro de ella; `innerKey` la lista anidada (`socialLinks`).
   */
  const handleNestedArrayItemChange = (
    outerPath: string,
    outerIndex: number,
    innerKey: string,
    innerIndex: number,
    fieldKey: string,
    newValue: any,
  ) => {
    const outer = [...(props[outerPath] || [])];
    const item = { ...outer[outerIndex] };
    const inner = [...(item[innerKey] || [])];

    inner[innerIndex] =
      fieldKey === ""
        ? newValue
        : { ...(inner[innerIndex] ?? {}), [fieldKey]: newValue };

    item[innerKey] = inner;
    outer[outerIndex] = item;
    onUpdateProp(selectedBlock.id, outerPath, outer);
  };

  /** Añade un item vacio a una lista anidada (`socialLinks`). */
  const handleAddNestedArrayItem = (
    outerPath: string,
    outerIndex: number,
    innerKey: string,
  ) => {
    const outer = [...(props[outerPath] || [])];
    const item = { ...outer[outerIndex] };
    const inner = [...(item[innerKey] || [])];

    // El item nuevo hereda las claves del primero, para que salga con los
    // mismos campos (`label`, `href`, `icon`) en vez de vacio.
    const template =
      inner.length > 0 && typeof inner[0] === "object"
        ? Object.keys(inner[0]).reduce(
            (acc, k) => {
              acc[k] = isIconProp(k)
                ? "FaInstagram"
                : isLinkProp(k)
                  ? "https://"
                  : "";
              return acc;
            },
            {} as Record<string, any>,
          )
        : { label: "", href: "", icon: "FaInstagram" };

    inner.push(template);
    item[innerKey] = inner;
    outer[outerIndex] = item;
    onUpdateProp(selectedBlock.id, outerPath, outer);
  };

  /** Quita un item de una lista anidada. */
  const handleRemoveNestedArrayItem = (
    outerPath: string,
    outerIndex: number,
    innerKey: string,
    innerIndex: number,
  ) => {
    const outer = [...(props[outerPath] || [])];
    const item = { ...outer[outerIndex] };
    const inner = [...(item[innerKey] || [])];

    inner.splice(innerIndex, 1);
    item[innerKey] = inner;
    outer[outerIndex] = item;
    onUpdateProp(selectedBlock.id, outerPath, outer);
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
  ) => {
    const isFocused = focusedFieldKey === locationKey;

    return (
      <div
        key={locationKey}
        // El `locationKey` es la ruta que resuelve el canvas al hacer click
        // sobre un texto. Se expone en el DOM para que el panel pueda encontrar
        // este input y scrollear hasta el.
        data-field-key={locationKey}
        className={`flex flex-col rounded-lg transition-all ${
          isFocused
            ? "bg-amber-400/10 ring-1 ring-amber-400/60 p-1.5 -m-1.5"
            : ""
        }`}
      >
        {renderFieldContent(key, value, onChange, locationKey)}
      </div>
    );
  };

  const renderFieldContent = (
    key: string,
    value: any,
    onChange: (newValue: any) => void,
    locationKey: string,
  ) => {
    // 1. Selector de Enlaces (HREF / URL / LINK)
    //
    // Se comprueba que el valor sea TEXTO antes de pintar el selector: un campo
    // llamado `icon` dentro de una lista puede llegar como objeto, y sin esta
    // guarda el `String(value)` de mas abajo imprimia `[object Object]`.
    if (isLinkProp(key) && typeof value === "string") {
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
                  ALL_BLOCKS_MAP.get(block.metaName)?.component?.displayName ||
                  block.metaName;
                const anchor = blockAnchorHref(block);
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
    if (isIconProp(key) && typeof value === "string") {
      // Se resuelve contra TODOS los sets (lucide + simple-icons + font-awesome),
      // no solo lucide: `FaInstagram` viene de font-awesome y con el fallback
      // anterior el boton mostraba un icono de interrogacion.
      const IconComponent =
        (ALL_ICONS as any)[value] || LucideIcons.HelpCircle;
      const isOpen = activeIconProp?.propName === locationKey;

      return (
        <div className="flex flex-col gap-1 relative">
          <label className="text-[10px] font-medium text-stone-400 capitalize">
            {key}
          </label>
          <button
            type="button"
            data-icon-picker-toggle="true"
            onClick={() => {
              // Se limpia al ABRIR otro campo: si no, el selector se abre ya
              // filtrado con lo que se busco en el anterior.
              if (!isOpen) setIconSearch("");
              setActiveIconProp(isOpen ? null : { propName: locationKey });
            }}
            className="flex items-center justify-between gap-2 rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-200 hover:border-stone-700"
          >
            <div className="flex items-center gap-2">
              <IconComponent className="h-4 w-4 text-amber-400" />
              <span>{value || "Seleccionar icono"}</span>
            </div>
            <Smile className="h-3.5 w-3.5 text-stone-500" />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 z-30 mt-1 w-full rounded-xl border border-stone-800 bg-stone-900 p-2 shadow-xl">
              {/*
                Buscador.

                La rejilla muestra ~20 iconos; sin buscador, cambiar el icono de
                un enlace social obliga a recorrer una lista fija que no incluye
                lo que el cliente quiere. Busca por nombre, etiqueta y palabras
                clave (ver `matchesIconQuery`).
              */}
              <input
                type="text"
                data-icon-picker-search="true"
                autoFocus
                placeholder="Buscar ícono..."
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                className="mb-2 w-full rounded-lg border border-stone-800 bg-stone-950 px-2 py-1 text-[11px] text-stone-200 outline-none focus:border-amber-400/50"
              />

              <div className="grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto">
                {iconOptions.map((iconName: string) => {
                  const ItemIcon = (ALL_ICONS as any)[iconName];
                  if (!ItemIcon) return null;

                  const label =
                    BUSINESS_ICONS.find((icon) => icon.name === iconName)
                      ?.label ?? iconName;

                  return (
                    <button
                      key={iconName}
                      type="button"
                      data-icon-option={iconName}
                      title={label}
                      onClick={() => {
                        onChange(iconName);
                        setActiveIconProp(null);
                        setIconSearch("");
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg hover:bg-stone-800 transition ${
                        value === iconName
                          ? "bg-amber-400/10 text-amber-300 border border-amber-400/30"
                          : "text-stone-400"
                      }`}
                    >
                      <ItemIcon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>

              {iconOptions.length === 0 ? (
                <p className="px-2 py-3 text-center text-[10px] text-stone-500">
                  Ningún ícono coincide.
                </p>
              ) : null}
            </div>
          )}
        </div>
      );
    }

    // 3. Selector de IMAGEN
    //
    // Va antes que el color: `heroImageSrc` y `backgroundColor` comparten
    // forma (una cadena), y sin este orden el primero caeria en el control de
    // color.
    if (isImageProp(key, value)) {
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium capitalize text-stone-400">
            {fieldLabels.get(key) ?? key}
          </label>

          <button
            type="button"
            onClick={() => setImagePickerField(locationKey)}
            className="group relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-stone-800 bg-stone-950 transition hover:border-amber-400"
          >
            {value ? (
              <img
                src={String(value)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[11px] text-stone-500">Sin imagen</span>
            )}

            <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
              Cambiar
            </span>
          </button>
        </div>
      );
    }

    // 3.5 Selector de opciones (`control: "select"`)
    //
    // Va antes del color a proposito: un campo puede llamarse `position` y no
    // parecerse a ningun control conocido, pero declarar sus opciones en el
    // meta. Sin esto caia en el input de texto libre.
    const def = fieldDefs.get(key);
    if (def?.control === "select" && def.options?.length) {
      return (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium capitalize text-stone-400">
            {key}
          </label>
          <select
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="w-full cursor-pointer rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-200 outline-none focus:border-amber-400"
          >
            {def.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // 4. Control de Color
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
    if (typeof value === "boolean") {      return (
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

    // 5. Objeto anidado
    //
    // Se comprueba ANTES del input de texto: un valor que no sea primitivo
    // imprimia `[object Object]`, porque el input hace `String(value)`. Ahora se
    // listan sus campos, que es lo que el usuario espera editar.
    if (typeof value === "object" && value !== null) {
      return (
        <div className="flex flex-col gap-1.5 rounded-lg border border-stone-800 bg-stone-950/40 p-2">
          <label className="text-[10px] font-medium text-stone-400 capitalize">
            {key}
          </label>
          {Object.entries(value as Record<string, unknown>).map(
            ([subKey, subValue]) => (
              <div
                key={subKey}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="text-stone-500">{subKey}</span>
                <span className="truncate text-stone-300">
                  {typeof subValue === "object"
                    ? "—"
                    : String(subValue ?? "")}
                </span>
              </div>
            ),
          )}
        </div>
      );
    }

    // 6. Input Estándar
    return (      <div className="flex flex-col gap-1">
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

  /**
   * Definicion completa de cada campo del meta.
   *
   * El panel decidia el control por el NOMBRE del prop (`isColorProp`,
   * `isIconProp`...), asi que un `control: "select"` declarado en el meta se
   * ignoraba y el campo salia como input de texto libre. Con esto el panel
   * puede respetar el `control` que declaro el componente, que es quien sabe
   * que valores admite.
   */
  const fieldDefs = new Map<
    string,
    { control?: string; options?: { label: string; value: string }[] }
  >();
  const meta = registryEntry?.meta;

  const collectLabels = (
    fields:
      | readonly {
          name: string;
          label: string;
          control?: string;
          options?: { label: string; value: string }[];
        }[]
      | undefined,
  ) => {
    for (const field of fields ?? []) {
      fieldLabels.set(field.name, field.label);
      fieldDefs.set(field.name, {
        control: field.control,
        options: field.options,
      });
    }
  };

  collectLabels(meta?.fields);
  for (const group of meta?.groups ?? []) collectLabels(group.fields);

  return (
    <aside
      ref={panelRef}
      className="w-80 border-l border-stone-800 bg-stone-900/50 p-4 overflow-y-auto"
    >
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
                data-field-key={propName}
                className={`flex flex-col gap-2 rounded-xl border p-3 transition-all ${
                  focusedFieldKey === propName
                    ? "border-amber-400/60 bg-amber-400/5"
                    : "border-stone-800 bg-stone-950/50"
                }`}
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
                          ? Object.entries(item).map(([subKey, subValue]) => {
                              // Una lista DENTRO del item (las redes de un
                              // miembro del equipo) necesita su propia lista
                              // editable, no un campo de texto.
                              if (Array.isArray(subValue)) {
                                const nestedId = `${propName}-${index}-${subKey}`;
                                return (
                                  <NestedList
                                    key={nestedId}
                                    label={subKey}
                                    items={subValue}
                                    idPrefix={nestedId}
                                    isCollapsed={!!collapsedLists[nestedId]}
                                    onToggleCollapse={() =>
                                      toggleListCollapse(nestedId)
                                    }
                                    onChange={(
                                      innerIndex,
                                      fieldKey,
                                      newValue,
                                    ) =>
                                      handleNestedArrayItemChange(
                                        propName,
                                        index,
                                        subKey,
                                        innerIndex,
                                        fieldKey,
                                        newValue,
                                      )
                                    }
                                    onAdd={() =>
                                      handleAddNestedArrayItem(
                                        propName,
                                        index,
                                        subKey,
                                      )
                                    }
                                    onRemove={(innerIndex) =>
                                      handleRemoveNestedArrayItem(
                                        propName,
                                        index,
                                        subKey,
                                        innerIndex,
                                      )
                                    }
                                    renderField={renderSingleField}
                                  />
                                );
                              }

                              return renderSingleField(
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
                              );
                            })
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

      {/* Selector de imagenes. Se monta al final para que el modal quede por
          encima del panel, sin depender del orden de los elementos. */}
      {imagePickerField && selectedBlock ? (
        <ImagePickerModal
          currentUrl={String(
            readValueByLocationKey(props, imagePickerField) ?? "",
          )}
          onSelect={(url) =>
            writeValueByLocationKey(
              props,
              imagePickerField,
              selectedBlock.id,
              onUpdateProp,
              url,
            )
          }
          onClose={() => setImagePickerField(null)}
        />
      ) : null}
    </aside>
  );
}

/**
 * Lee el valor de un campo a partir de su `locationKey`.
 *
 * El panel identifica los campos con claves aplanadas (`images-0-src`) porque
 * asi puede resaltarlos en el DOM. Para leer o escribir hay que volver a la
 * estructura real (`props.images[0].src`), y ahi es donde aparece la ambiguedad:
 * los guiones pueden venir del nombre de la prop o del separador del indice.
 *
 * Se resuelve recorriendo los arrays conocidos: es determinista porque se
 * comparan las claves REALES de los props, no se adivina cortando por guiones.
 */
function readValueByLocationKey(
  props: Record<string, any>,
  locationKey: string,
): unknown {
  // Campo de primer nivel.
  if (locationKey in props) return props[locationKey];

  for (const [propName, propValue] of Object.entries(props)) {
    if (!Array.isArray(propValue)) continue;

    const prefix = `${propName}-`;
    if (!locationKey.startsWith(prefix)) continue;

    const rest = locationKey.slice(prefix.length);
    const [indexText, ...subKeyParts] = rest.split("-");
    const index = Number(indexText);

    if (!Number.isInteger(index) || !propValue[index]) continue;

    const subKey = subKeyParts.join("-");

    return subKey ? propValue[index][subKey] : propValue[index];
  }

  return undefined;
}

/**
 * Escribe el valor de un campo a partir de su `locationKey`.
 *
 * Reutiliza los mismos callbacks que usa el panel (`onUpdateProp` para el primer
 * nivel, reconstruyendo el array para los items), para que el cambio del modal
 * pase por el MISMO camino que el de un input normal: si se escribiera aparte,
 * el guardado y el historial podrian divergir.
 */
function writeValueByLocationKey(
  props: Record<string, any>,
  locationKey: string,
  blockId: string,
  onUpdateProp: (blockId: string, propName: string, value: any) => void,
  value: unknown,
): void {
  if (locationKey in props) {
    onUpdateProp(blockId, locationKey, value);
    return;
  }

  for (const [propName, propValue] of Object.entries(props)) {
    if (!Array.isArray(propValue)) continue;

    const prefix = `${propName}-`;
    if (!locationKey.startsWith(prefix)) continue;

    const rest = locationKey.slice(prefix.length);
    const [indexText, ...subKeyParts] = rest.split("-");
    const index = Number(indexText);

    if (!Number.isInteger(index) || !propValue[index]) continue;

    const subKey = subKeyParts.join("-");
    const nextArray = [...propValue];

    nextArray[index] = subKey
      ? { ...nextArray[index], [subKey]: value }
      : value;

    onUpdateProp(blockId, propName, nextArray);
    return;
  }
}
