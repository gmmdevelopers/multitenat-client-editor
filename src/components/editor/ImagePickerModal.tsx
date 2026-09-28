"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, Upload, ImageIcon, X, Check } from "lucide-react";

import { getErrorMessage } from "@/lib/api/errors";
import {
  deleteUpload,
  listUploads,
  uploadImageFile,
  type TenantImage,
} from "@/lib/api/uploads";
import { getDefaultImages, type DefaultImage } from "@/lib/default-images";

type Tab = "mine" | "defaults";

/**
 * Selector de imagenes: galeria del tenant + imagenes por defecto del DS.
 *
 * Se abre desde el panel de propiedades cuando el cliente pulsa un campo de
 * imagen. Dos pestañas porque son dos origenes distintos:
 *
 *   - "Mis imagenes": lo que el cliente ha subido.
 *   - "Por defecto": las fotos que trae el design system, para que un cliente
 *     recien registrado tenga algo que elegir antes de subir nada.
 *
 * Las imagenes se muestran SIN transformar. La optimizacion (WebP) se aplica
 * solo en la web publica: aqui el objetivo es elegir, no servir trafico.
 */
export function ImagePickerModal({
  currentUrl,
  onSelect,
  onClose,
}: {
  currentUrl: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(
    currentUrl.includes("/tenants/") ? "mine" : "defaults",
  );
  const [images, setImages] = useState<TenantImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const defaults = getDefaultImages();

  const loadImages = useCallback(async () => {
    setIsLoading(true);
    try {
      setImages(await listUploads());
    } catch (caught) {
      setError(getErrorMessage(caught, "No pudimos cargar tus imagenes."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  // Cerrar con Escape: es un modal, y el teclado debe funcionar.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    try {
      const created = await uploadImageFile(file);
      // La imagen recien subida se selecciona directamente: el cliente ya sabe
      // que la quiere, obligarle a buscarla en la galeria es un paso de mas.
      onSelect(created.url);
      onClose();
    } catch (caught) {
      setError(getErrorMessage(caught, "No pudimos subir la imagen."));
      setIsUploading(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(event.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Quitar esta imagen de tu galeria?\n\nLas paginas que la usen mostraran la imagen por defecto del bloque.",
    );
    if (!confirmed) return;

    try {
      await deleteUpload(id);
      setImages((current) => current.filter((image) => image.id !== id));
    } catch (caught) {
      setError(getErrorMessage(caught, "No pudimos eliminarla."));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />

      <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-stone-800 bg-stone-900 shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-stone-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">Elegir imagen</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded p-1 text-stone-400 transition hover:bg-stone-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Pestanas */}
        <div className="flex gap-1 border-b border-stone-800 px-5">
          <TabButton
            active={tab === "mine"}
            onClick={() => setTab("mine")}
            label="Mis imagenes"
            count={images.length}
          />
          <TabButton
            active={tab === "defaults"}
            onClick={() => setTab("defaults")}
            label="Por defecto"
            count={defaults.length}
          />
        </div>

        {error ? (
          <div
            role="alert"
            className="mx-5 mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
          >
            {error}
          </div>
        ) : null}

        {/* Contenido */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "mine" ? (
            <>
              {/* Zona de subida */}
              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`mb-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
                  isDragging
                    ? "border-amber-400 bg-amber-400/5"
                    : "border-stone-700 hover:border-stone-600"
                } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml"
                  className="hidden"
                  onChange={(event) => void handleFiles(event.target.files)}
                />
                <Upload className="h-5 w-5 text-amber-400" />
                <span className="text-sm font-medium text-stone-200">
                  {isUploading
                    ? "Subiendo..."
                    : "Arrastra una imagen o haz click para elegirla"}
                </span>
                <span className="text-[11px] text-stone-500">
                  PNG, JPG, WebP, AVIF, GIF o SVG · hasta 10 MB
                </span>
              </label>

              {isLoading ? (
                <p className="py-8 text-center text-sm text-stone-500">
                  Cargando...
                </p>
              ) : images.length === 0 ? (
                <div className="py-8 text-center">
                  <ImageIcon className="mx-auto mb-2 h-6 w-6 text-stone-600" />
                  <p className="text-sm text-stone-500">
                    Todavia no has subido imagenes.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {images.map((image) => (
                    <ImageTile
                      key={image.id}
                      url={image.url}
                      label={image.fileName}
                      selected={image.url === currentUrl}
                      onSelect={() => {
                        onSelect(image.url);
                        onClose();
                      }}
                      onDelete={() => void handleDelete(image.id)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {defaults.map((image) => (
                <ImageTile
                  key={image.url}
                  url={image.url}
                  label={image.sourceLabel}
                  selected={image.url === currentUrl}
                  onSelect={() => {
                    onSelect(image.url);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2.5 text-xs font-medium transition ${
        active
          ? "border-amber-400 text-amber-300"
          : "border-transparent text-stone-400 hover:text-stone-200"
      }`}
    >
      {label}
      <span className="ml-1.5 rounded-full bg-stone-800 px-1.5 text-[10px] text-stone-400">
        {count}
      </span>
    </button>
  );
}

function ImageTile({
  url,
  label,
  selected,
  onSelect,
  onDelete,
}: {
  url: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        title={label}
        className={`block w-full overflow-hidden rounded-lg border-2 transition ${
          selected
            ? "border-amber-400"
            : "border-transparent hover:border-stone-600"
        }`}
      >
        {/* `loading="lazy"`: la galeria puede tener muchas imagenes y no todas
            estan a la vista al abrir el modal. */}
        <img
          src={url}
          alt={label}
          loading="lazy"
          className="h-24 w-full bg-stone-950 object-cover"
        />

        {selected ? (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-stone-900">
            <Check className="h-3 w-3" />
          </span>
        ) : null}
      </button>

      <p className="mt-1 truncate text-[10px] text-stone-500">{label}</p>

      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          title="Quitar de mi galeria"
          className="absolute left-1.5 top-1.5 hidden rounded bg-black/70 p-1 text-stone-300 transition hover:bg-red-600 hover:text-white group-hover:block"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}