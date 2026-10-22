"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Search, Tag, X } from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import { updatePage } from "@/lib/api/pages";

/** Etiquetas que se pueden añadir por pagina. Igual que el limite del backend. */
const MAX_TAGS = 10;

/** Caracteres por etiqueta. Igual que el limite del backend. */
const MAX_TAG_LENGTH = 40;

/**
 * Limites de titulo y descripcion SEO.
 *
 * No son inventados: son los que Google muestra antes de recortar (~60 en el
 * titulo y ~155-160 en la descripcion). Pasarse no penaliza, pero lo que sobra
 * no se ve, asi que el contador avisa antes de llegar.
 */
const MAX_SEO_TITLE = 60;
const MAX_SEO_DESCRIPTION = 160;

/**
 * Panel de SEO: las etiquetas del cliente, como chips.
 *
 * ## La advertencia va EN LA PANTALLA, no solo en un comentario
 *
 * Google **ignora** `<meta name="keywords">` desde 2009. Si se presenta esto
 * como "mejora tu posicionamiento", el cliente pagara por un campo que no hace
 * nada y lo notara. Por eso el aviso esta visible: sirve para dos cosas reales
 * (Open Graph y busqueda interna) y para que el cliente sienta que controla algo.
 *
 * ## Por que un input con Enter y no un textarea con comas
 *
 * Una etiqueta puede tener espacios ("implantes dentales"), y con comas habria
 * que prohibirlas dentro del texto. El chip deja claro **donde termina** cada
 * etiqueta, que con una linea de comas separadas no se ve.
 */
export function SeoTagsPanel({
  pageId,
  initialTags,
  initialTitle,
  initialDescription,
  onSaved,
}: {
  pageId: string;
  /** Las etiquetas que ya tenia la pagina. */
  initialTags: string[];
  /** Titulo SEO actual (el que ve Google). */
  initialTitle: string;
  /** Descripcion SEO actual (la que sale bajo el titulo en Google). */
  initialDescription: string;
  /** Tras guardar, para que el editor marque la pagina como editada. */
  onSaved: () => void;
}) {
  const toast = useToast();

  const [tags, setTags] = useState<string[]>(initialTags);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Si llega otra pagina, se repinta todo.
   *
   * El editor reutiliza este panel al cambiar de pagina: sin esto se seguirian
   * viendo los datos de la anterior, y guardarlos los escribiria en la nueva.
   */
  useEffect(() => {
    setTags(initialTags);
    setTitle(initialTitle);
    setDescription(initialDescription);
    setDraft("");
  }, [initialTags, initialTitle, initialDescription, pageId]);

  /**
   * Hay cambios si **alguno** de los tres campos difiere de lo guardado.
   *
   * Se compara campo por campo y no el objeto entero porque los valores se
   * normalizan al guardar (se recortan espacios): comparar objetos daria
   * "cambios" para siempre y el boton nunca se desactivaria.
   */
  const hasChanges =
    title.trim() !== initialTitle.trim() ||
    description.trim() !== initialDescription.trim() ||
    JSON.stringify(tags) !== JSON.stringify(initialTags);

  /**
   * Normaliza y añade una etiqueta.
   *
   * Devuelve un mensaje de error en vez de lanzarlo: lo que falla aqui es una
   * entrada del usuario, y el aviso va junto al campo, no al toast global.
   */
  function addTag(raw: string): string | null {
    const value = raw.trim().replace(/\s+/g, " ");

    if (!value) return null;

    if (value.length > MAX_TAG_LENGTH) {
      return `Máximo ${MAX_TAG_LENGTH} caracteres por etiqueta.`;
    }

    if (tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      return "Esa etiqueta ya está añadida.";
    }

    if (tags.length >= MAX_TAGS) {
      return `Máximo ${MAX_TAGS} etiquetas.`;
    }

    setTags([...tags, value]);
    return null;
  }

  function handleAdd() {
    const error = addTag(draft);
    if (error) {
      toast.error(error);
      return;
    }
    setDraft("");
  }

  function handleRemove(tag: string) {
    setTags(tags.filter((item) => item !== tag));
  }

  async function handleSave() {
    if (!pageId) return;

    setIsSaving(true);
    try {
      /**
       * Los tres campos van en **una** peticion.
       *
       * No se guarda titulo y descripcion por separado: si el usuario cambia los
       * tres y solo se guardara uno, los otros dos quedarian "perdidos" en la
       * pantalla (se verian cambiados sin estarlo).
       *
       * Las etiquetas se mandan aunque esten vacias: es la forma de **borrarlas**.
       * Si se omitieran, el backend las dejaria como estaban.
       */
      await updatePage(pageId, {
        seoTitle: title.trim(),
        seoDescripcion: description.trim(),
        seoTags: tags,
      });
      toast.success("SEO guardado");
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo guardar el SEO."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/*
        Titulo y descripcion VAN PRIMERO.

        Son lo que de verdad usa Google para describir la pagina: el orden del
        panel sigue el de su importancia. Las etiquetas, que Google ignora, van
        debajo y con su aviso.
      */}
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
        <Search className="h-3.5 w-3.5" />
        Cómo aparece en Google
      </p>

      {/* --- Titulo --- */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="seo-title"
          className="text-[10px] font-semibold uppercase tracking-wider text-stone-500"
        >
          Título
        </label>
        <input
          id="seo-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={isSaving}
          // El limite recomendado por Google es ~60 caracteres: se corta en el
          // input para que el cliente lo vea mientras escribe, en vez de
          // enterarse cuando Google trunque el titulo en los resultados.
          maxLength={MAX_SEO_TITLE}
          placeholder="Clinica Dental Santiago | Implantes"
          className="w-full rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1.5 text-[11px] text-stone-200 placeholder-stone-600 outline-none focus:border-amber-400"
        />
        <span
          className={`text-[10px] ${
            title.length > MAX_SEO_TITLE - 10
              ? "text-amber-400"
              : "text-stone-600"
          }`}
        >
          {title.length}/{MAX_SEO_TITLE}
        </span>
      </div>

      {/* --- Descripcion --- */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="seo-description"
          className="text-[10px] font-semibold uppercase tracking-wider text-stone-500"
        >
          Descripción
        </label>
        <textarea
          id="seo-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isSaving}
          // ~160 caracteres es lo que muestra Google antes de cortar.
          maxLength={MAX_SEO_DESCRIPTION}
          rows={3}
          placeholder="Odontología integral en Providencia. Implantes, ortodoncia y urgencias con hora el mismo día."
          className="w-full resize-none rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1.5 text-[11px] leading-relaxed text-stone-200 placeholder-stone-600 outline-none focus:border-amber-400"
        />
        <span
          className={`text-[10px] ${
            description.length > MAX_SEO_DESCRIPTION - 20
              ? "text-amber-400"
              : "text-stone-600"
          }`}
        >
          {description.length}/{MAX_SEO_DESCRIPTION}
        </span>
      </div>

      <div className="h-px bg-stone-800" />

      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
        <Tag className="h-3.5 w-3.5" />
        Etiquetas de la página
      </p>

      {/* El campo, con Enter para añadir: es el gesto que se espera de un
          campo de etiquetas, y evita tener que buscar un boton. */}
      {/*
        `style={{ outline: "none" }}` en el input y NO una clase de Tailwind.

        Una regla GLOBAL de `:focus-visible` en `globals.css` tiene mas
        especificidad que `outline-none`, asi que la clase no servia: se seguian
        viendo dos bordes, el del contenedor (`focus-within`) y el del propio
        input. Inline gana a la hoja de estilos sin `!important`.

        El foco sigue siendo visible por el borde del contenedor.
      */}
      <div className="flex items-center gap-2 rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1.5 focus-within:border-amber-400">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAdd();
            }
            // Retroceso con el campo vacio borra la ultima: asi se pueden quitar
            // sin soltar el teclado.
            if (event.key === "Backspace" && draft === "" && tags.length > 0) {
              handleRemove(tags[tags.length - 1]);
            }
          }}
          disabled={isSaving || tags.length >= MAX_TAGS}
          placeholder={
            tags.length >= MAX_TAGS
              ? `Máximo ${MAX_TAGS} etiquetas`
              : "Escribe una etiqueta y pulsa Enter"
          }
          aria-label="Nueva etiqueta"
          className="min-w-0 flex-1 bg-transparent text-[11px] text-stone-200 placeholder-stone-600 disabled:cursor-not-allowed"
          style={{ outline: "none" }}
        />

        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim() || isSaving || tags.length >= MAX_TAGS}
          title="Añadir etiqueta"
          className="rounded-md p-1 text-stone-400 transition hover:bg-stone-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" data-seo-tags>
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 py-1 pl-2.5 pr-1.5 text-[11px] font-medium text-amber-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                disabled={isSaving}
                title={`Quitar «${tag}»`}
                className="rounded-full p-0.5 text-amber-200/70 transition hover:bg-amber-400/20 hover:text-amber-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-800 p-3 text-center text-[10px] leading-relaxed text-stone-500">
          Sin etiquetas. Son opcionales.
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-stone-600">
          {tags.length}/{MAX_TAGS}
        </span>

        <button
          type="button"
          data-save-seo-tags="true"
          onClick={() => void handleSave()}
          disabled={!hasChanges || isSaving}
          className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          Guardar etiquetas
        </button>
      </div>

      {/*
        El aviso honesto. Va aqui y no en un comentario del codigo porque quien
        lo necesita leer es el cliente, no quien programa.
      */}
      <p className="text-[10px] leading-relaxed text-stone-500">
        Google no usa estas etiquetas para posicionar. Sirven para las vistas
        previas al compartir el enlace y para la búsqueda dentro del sitio.
      </p>
    </div>
  );
}
