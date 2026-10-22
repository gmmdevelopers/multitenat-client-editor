"use client";

import { useEffect, useState } from "react";

import { anchorIdFromHash } from "@/lib/anchor";

/**
 * Desplaza la pagina al bloque indicado por el `#` de la URL.
 *
 * ## Por que no basta con que el bloque tenga `id`
 *
 * Con el `id` puesto, el navegador salta solo... **cuando la pagina se carga de
 * cero**. Aqui no ocurre eso: se navega con el router de Next a
 * `/preview?pageId=...#agenda-1791`, los bloques llegan **despues** de una
 * peticion a la API y se montan cuando ya se resolvio el fragmento. En ese
 * momento no hay destino al que saltar, y el navegador no lo vuelve a intentar.
 *
 * Es la causa 2 de las que se habian anotado: *Next intenta desplazarse antes de
 * que el contenido exista*.
 *
 * ## Por que `scrollIntoView` y no `window.scrollTo`
 *
 * El scroll de la vista previa del editor **no vive en la ventana**: esta dentro
 * de un `overflow-y-auto`. `scrollIntoView` funciona en los dos casos, porque
 * actua sobre los ancestros que scrollean de verdad.
 *
 * @param hash   El fragmento esperado (`#agenda-1791`), normalmente sacado de la
 *               propiedad de un boton o de `window.location.hash`.
 * @param ready  Si el contenido ya esta montado. Es lo que permite reintentar
 *               cuando llegan los bloques: sin esto, el primer intento falla
 *               siempre y no habria un segundo.
 */
export function useScrollToAnchor(hash: string | null | undefined, ready: boolean) {
  const [currentHash, setCurrentHash] = useState(hash ?? "");

  /**
   * El `#` de la URL cambia **tambien sin recargar**.
   *
   * Un boton de la propia pagina que apunta a `#agenda-1791` solo modifica el
   * fragmento: no hay navegacion ni re-render. Escuchando `hashchange` el salto
   * funciona tambien cuando el enlace se pulsa dentro de la pagina, no solo
   * cuando se entra con el `#` ya en la URL.
   */
  useEffect(() => {
    setCurrentHash(hash ?? "");

    function onHashChange() {
      setCurrentHash(window.location.hash);
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [hash]);

  useEffect(() => {
    if (!ready || !currentHash) return;

    const id = anchorIdFromHash(currentHash);

    /**
     * Se busca en cada intento y no se guarda el nodo: los bloques se vuelven a
     * montar en cada recarga y una referencia vieja apuntaria a un nodo que ya
     * no esta en el documento.
     *
     * `requestAnimationFrame` deja que React termine de pintar: medir antes
     * daria 0 para un elemento que aun no tiene altura.
     */
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(id);

      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => cancelAnimationFrame(frame);
  }, [currentHash, ready]);
}
