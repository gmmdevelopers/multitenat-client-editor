"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import {
  BUSINESS_ICONS,
  POPULAR_UI_ICONS,
  UI_ICON_COMPONENTS,
  UI_ICON_KEYWORDS,
  UI_ICON_NAMES,
  type BusinessIcon,
} from "@multitenant/design-system";

interface IconPickerSelectProps {
  value: string;
  onChange: (iconName: string) => void;
}

type IconComponent = React.ElementType<{ className?: string }>;

/** El catalogo completo: interfaz (curado) + marcas. */
const ALL_ICONS: Record<string, IconComponent> = {
  ...UI_ICON_COMPONENTS,
  ...Object.fromEntries(
    BUSINESS_ICONS.map((icon) => [icon.name, icon.component]),
  ),
} as Record<string, IconComponent>;

/** Cuantos resultados de interfaz se pintan. Ver el aviso del corte. */
const MAX_VISIBLE_ICONS = 60;

/**
 * Alto maximo del desplegable, en px.
 *
 * Se amplia a 400 (antes 320) porque el panel muestra DOS grupos con etiqueta
 * ("Marcas y redes" e "Interfaz") y a 320 px la seccion de interfaz quedaba
 * cortada a la primera fila, sin que se viera que hay mas abajo.
 */
const MAX_PANEL_HEIGHT = 400;

/**
 * Ancho minimo del desplegable, en px.
 *
 * El campo del panel mide ~239 px y en dos columnas el texto no cabe: las marcas
 * salian como "WhatsApp (r..." y "WhatsApp (..." — las dos truncadas igual, sin
 * forma de distinguir la rellena de la de contorno, que es justo la diferencia
 * que importa.
 *
 * Se ensancha hacia la derecha desde el borde izquierdo del campo. 340 px dejan
 * ver "WhatsApp (relleno)" completo en dos columnas.
 */
const MIN_PANEL_WIDTH = 340;

/** Separacion entre el boton y el desplegable. */
const GAP = 8;

/**
 * Selector de icono para los bloques.
 *
 * ## Dos grupos, y por qué
 *
 * | Grupo | De dónde | Cuántos |
 * |---|---|---|
 * | **Marca** (redes, WhatsApp) | `BUSINESS_ICONS`, del design system | 12 |
 * | **Interfaz** (flechas, checks, estrellas) | `UI_ICON_COMPONENTS`, del design system | ~60 |
 *
 * Las dos listas salen del **design system**, que es la única fuente. Antes este
 * selector hacía `import * as LucideIcons` y ofrecía ~2.100 iconos: el negocio
 * elegía uno que la web no sabía pintar y **su página salía sin icono**, sin
 * ningún error.
 *
 * Es la regla: **el selector no puede ofrecer nada que la web no sepa pintar.**
 * Y la única forma de garantizarlo es que las dos apunten a la misma lista.
 *
 * ## Por qué el desplegable va en un PORTAL
 *
 * El panel de propiedades es un `<aside>` con `overflow-y-auto`. Un desplegable
 * `absolute` **no puede escapar** de ese recorte: se cortaba al llegar al borde
 * del panel y los campos siguientes lo tapaban (se veían dos iconos de seis).
 *
 * Por eso se pinta en un portal sobre `document.body` con `position: fixed`,
 * medido contra la **ventana**: no hay contenedor que lo recorte.
 *
 * ## La búsqueda
 *
 * Busca en tres cosas a la vez: el nombre técnico (`FaWhatsapp`), la etiqueta
 * (`WhatsApp (relleno)`) y las palabras clave (`wsp`, `contacto`). Buscar solo
 * por nombre hacía que escribir "whatsapp" encontrara el icono y "wsp" no.
 *
 * Ignora tildes y mayúsculas: "instagrám" e "INSTAGRAM" llegan igual.
 */
export function IconPickerSelect({ value, onChange }: IconPickerSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  /** El boton, para colocar el portal junto a el. */
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  /**
   * La posicion del desplegable, en coordenadas de VENTANA.
   *
   * `null` = cerrado. Se guarda calculado (y no se lee `window` al pintar) para
   * que el componente siga siendo valido en el servidor.
   */
  const [rect, setRect] = useState<{
    top: number;
    bottomInset: number;
    left: number;
    width: number;
    maxHeight: number;
    opensUp: boolean;
  } | null>(null);

  /** Normaliza para comparar: sin tildes, minúsculas. */
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const query = normalize(search.trim());

  /**
   * Los iconos de interfaz que se listan.
   *
   * Sin búsqueda, la rejilla corta (`POPULAR_UI_ICONS`); con búsqueda, todo el
   * catálogo. Sin texto, listar 60 de golpe no aporta: nadie los recorre.
   */
  const uiIcons = query ? UI_ICON_NAMES : POPULAR_UI_ICONS;

  const brandMatches = useMemo(() => {
    if (!query) return BUSINESS_ICONS;

    return BUSINESS_ICONS.filter((icon) =>
      [icon.name, icon.label, ...(icon.keywords ?? [])]
        .map(normalize)
        .some((text) => text.includes(query)),
    );
  }, [query]);

  const uiMatches = useMemo(() => {
    if (!query) return uiIcons;

    return uiIcons.filter((name) =>
      [name, ...(UI_ICON_KEYWORDS[name] ?? [])]
        .map(normalize)
        .some((text) => text.includes(query)),
    );
  }, [query, uiIcons]);

  const CurrentIcon = useMemo(() => {
    const brand = BUSINESS_ICONS.find((icon) => icon.name === value);
    if (brand) return brand.component;

    return ALL_ICONS[value] ?? HelpCircle;
  }, [value]);

  /**
   * Etiqueta legible del valor actual.
   *
   * Para las marcas es su `label` ("WhatsApp (relleno)"). Para los iconos de
   * interfaz se usa la primera palabra clave en español ("corazon" para
   * `Heart`), y solo si no tiene, el nombre técnico.
   *
   * Es el mismo criterio que el desplegable: quien elige "corazon" y vuelve a
   * abrir el campo espera leer "corazon", no `Heart`. Si el icono no tiene
   * traducción (`BadgeCheck`, `ShieldCheck`), el nombre técnico describe mejor
   * que inventar una palabra que nadie busca.
   */
  const currentLabel = useMemo(() => {
    const brand = BUSINESS_ICONS.find((icon) => icon.name === value);
    if (brand) return brand.label;

    return UI_ICON_KEYWORDS[value]?.[0] ?? value;
  }, [value]);

  /** Mide el hueco disponible y elige hacia donde abrir. */
  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const box = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - box.bottom - GAP;
    const spaceAbove = box.top - GAP;

    /**
     * Alto que ocupa el contenido, sin abrir.
     *
     * Sin busqueda hay 18 iconos de interfaz mas 12 de marca y dos etiquetas: no
     * cabe en el hueco de debajo del campo (esta al final del panel). Se mide
     * antes de decidir la direccion para no abrir hacia abajo con una franja de
     * 200 px y obligar a scrollear una lista corta.
     */
    const estimatedHeight = Math.min(MAX_PANEL_HEIGHT, 420);

    // Se abre hacia arriba si abajo no cabe el contenido Y arriba hay mas sitio.
    const opensUp =
      spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    /**
     * Se ensancha hacia la derecha, pero sin salirse de la ventana.
     *
     * El panel esta pegado al borde derecho, asi que crecer hacia la derecha
     * podria dejar el desplegable medio fuera. Se desplaza a la izquierda lo
     * justo y no mas: moverlo siempre alinearia el desplegable con el centro de
     * la pantalla, despegado de su campo.
     */
    const width = Math.max(box.width, MIN_PANEL_WIDTH);
    const overflowRight = box.left + width - (window.innerWidth - GAP);
    const left = overflowRight > 0 ? box.left - overflowRight : box.left;

    setRect({
      top: opensUp ? box.top - GAP : box.bottom + GAP,
      // Se guarda calculado: leer `window.innerHeight` al pintar rompe en el
      // servidor, donde no hay ventana.
      bottomInset: window.innerHeight - (box.top - GAP),
      left: Math.max(GAP, left),
      width,
      maxHeight: Math.min(
        MAX_PANEL_HEIGHT,
        Math.max(160, opensUp ? spaceAbove : spaceBelow),
      ),
      opensUp,
    });
  }, []);

  const open = () => {
    // Se limpia al abrir: si se quedara, el selector abriria ya filtrado por la
    // busqueda anterior.
    setSearch("");
    measure();
    setIsOpen(true);
  };

  /**
   * Cierra el desplegable si la pagina se desplaza.
   *
   * El portal esta en `fixed` y se posiciona UNA vez. Si el panel se scrollea,
   * el boton se mueve y el desplegable quedaria en el aire, desalineado.
   * Cerrarlo es mas honesto que perseguirlo a 60 fps.
   */
  useEffect(() => {
    if (!isOpen) return;

    const close = () => setIsOpen(false);

    // `true` en el tercer argumento: `scroll` no burbujea, hay que capturarlo.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        data-icon-picker-toggle="true"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-200 transition hover:border-stone-700"
      >
        <div className="flex min-w-0 items-center gap-2">
          <CurrentIcon className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="truncate">{currentLabel || "Seleccionar icono"}</span>
        </div>
        <span className="shrink-0 text-[10px] text-stone-500">▼</span>
      </button>

      {isOpen && rect
        ? createPortal(
            <div
              style={{
                position: "fixed",
                left: rect.left,
                width: rect.width,
                maxHeight: rect.maxHeight,
                zIndex: 100,
                // Al abrir hacia arriba se ancla por el FONDO: asi crece hacia
                // arriba aunque cambie el alto de la lista.
                ...(rect.opensUp
                  ? { bottom: rect.bottomInset }
                  : { top: rect.top }),
              }}
              className="overflow-y-auto rounded-xl border border-stone-800 bg-stone-900 p-2 shadow-2xl"
            >
              <input
                type="text"
                data-icon-picker-search="true"
                autoFocus
                placeholder="Buscar: whatsapp, corazon, telefono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
                className="mb-2 w-full rounded-lg border border-stone-800 bg-stone-950 px-2 py-1 text-[11px] text-stone-200 outline-none focus:border-amber-400/50"
              />

              {brandMatches.length > 0 ? (
                <div className="mb-2">
                  <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Marcas y redes
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {brandMatches.map((icon) => (
                      <BrandOption
                        key={icon.name}
                        icon={icon}
                        isSelected={value === icon.name}
                        onSelect={onChange}
                        onClose={() => setIsOpen(false)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {uiMatches.length > 0 ? (
                <div>
                  <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Interfaz
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {uiMatches.slice(0, MAX_VISIBLE_ICONS).map((iconName) => {
                      const IconComp = ALL_ICONS[iconName];
                      if (!IconComp) return null;

                      const label =
                        UI_ICON_KEYWORDS[iconName]?.[0] ?? iconName;

                      return (
                        <button
                          key={iconName}
                          type="button"
                          data-icon-option={iconName}
                          // El texto muestra la etiqueta ("corazon"), igual que el
                          // boton cerrado: si aqui dijera `Heart` y arriba
                          // "corazon", pareceria que se guardo otro icono. El
                          // nombre tecnico va en el `title`, que es lo que se
                          // guarda en el bloque y sirve para depurar.
                          title={iconName}
                          onClick={() => {
                            onChange(iconName);
                            setIsOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition ${
                            value === iconName
                              ? "bg-amber-400/10 font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/30"
                              : "text-stone-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <IconComp className="h-4 w-4 shrink-0" />
                          <span className="truncate">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {brandMatches.length === 0 && uiMatches.length === 0 ? (
                <p className="px-2 py-3 text-center text-[10px] text-stone-500">
                  Ningún ícono coincide con «{search}».
                </p>
              ) : null}

              {/*
                Si se corto la lista, se dice. Sin esto parece que la busqueda no
                encontro mas, cuando en realidad hay coincidencias sin mostrar.
              */}
              {uiMatches.length > MAX_VISIBLE_ICONS ? (
                <p className="mt-1.5 px-1 text-center text-[10px] text-stone-600">
                  Mostrando {MAX_VISIBLE_ICONS} de {uiMatches.length}. Escribe
                  más para afinar.
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Una opción de marca. Separada para que el `map` del render quede legible. */
function BrandOption({
  icon,
  isSelected,
  onSelect,
  onClose,
}: {
  icon: BusinessIcon;
  isSelected: boolean;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const IconComponent = icon.component;

  return (
    <button
      type="button"
      data-icon-option={icon.name}
      title={icon.name}
      onClick={() => {
        onSelect(icon.name);
        onClose();
      }}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition ${
        isSelected
          ? "bg-amber-400/10 font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/30"
          : "text-stone-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <IconComponent className="h-4 w-4 shrink-0" />
      {/* La etiqueta, no el nombre tecnico: "WhatsApp (relleno)" se entiende,
          "FaWhatsapp" no. Es la ventaja sobre el selector inline anterior. */}
      <span className="truncate">{icon.label}</span>
    </button>
  );
}
