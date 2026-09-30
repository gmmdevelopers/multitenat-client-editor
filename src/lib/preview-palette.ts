/**
 * Espejo de la paleta del sitio para la vista previa.
 *
 * El preview se abre en una pestana nueva (`window.open`), asi que no comparte
 * estado de React con el editor: la unica via es dejar la paleta en
 * localStorage, que si comparten porque es el mismo origen.
 *
 * Es SOLO para el preview. La web publicada toma la paleta del backend, que es
 * la fuente de verdad; si esto faltara, el preview mostraria los colores por
 * defecto y no la web real.
 */
export const PREVIEW_PALETTE_KEY = "site-palette-preview";

export interface PreviewPaletteSnapshot {
  palette: unknown;
  siteType: string | null;
}

/** Deja la paleta del editor visible para el preview. */
export function storePreviewPalette(snapshot: PreviewPaletteSnapshot): void {
  try {
    window.localStorage.setItem(PREVIEW_PALETTE_KEY, JSON.stringify(snapshot));
  } catch {
    // Modo privado o cuota llena: el preview caera a la paleta del vertical.
  }
}

/** Lee la paleta dejada por el editor. `null` si no hay nada guardado. */
export function readPreviewPalette(): PreviewPaletteSnapshot | null {
  try {
    const stored = window.localStorage.getItem(PREVIEW_PALETTE_KEY);
    if (!stored) return null;

    return JSON.parse(stored) as PreviewPaletteSnapshot;
  } catch {
    return null;
  }
}
