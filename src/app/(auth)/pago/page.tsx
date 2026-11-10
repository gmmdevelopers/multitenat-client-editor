"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Puente hacia la pasarela de pago.
 *
 * ## Por qué existe esta página
 *
 * Transbank Oneclick Mall **no acepta un GET** para abrir la pantalla de
 * inscripción: espera un **POST**. Abrir la URL directamente devuelve una
 * **página en blanco**, sin error.
 *
 * Mercado Pago sí acepta GET con su `initPoint`, así que este puente solo
 * actúa cuando el `method` es `POST`.
 *
 * ## La cadena de Transbank son TRES saltos
 *
 * ```
 * 1. POST  bp_multicode_inscription.cgi  (<- TBK_TOKEN)
 *          devuelve un <form> que reenvia a:
 * 2. POST  multicode_inscription.cgi     (<- TBK_TOKEN)
 *          devuelve un <form> que reenvia a:
 * 3. POST  dist/index.html               (<- token)
 *          ESTA es la pantalla de inscripcion
 * ```
 *
 * La primera y la segunda respuesta son formularios de autoenvío, no la
 * pantalla. El navegador tiene que **seguirlos todos**.
 *
 * ## Cómo se siguen sin jQuery
 *
 * Las respuestas son HTML con `<script>` que hacen `$(this).on("submit", ...)`
 * y `form.submit()`. Un `<form>` inyectado con `innerHTML` **no ejecuta sus
 * scripts**, así que en vez de replicar el reenvío se navega a la URL y se deja
 * que el propio navegador siga la cadena. Eso es lo que hace el puente solo en
 * el primer salto; los siguientes los resuelve Transbank.
 *
 * ## Seguridad
 *
 * El `token` viene del backend y es de un solo uso. Un `redirect` abierto aquí
 * solo llevaría a otra pasarela con un token inválido.
 */
function PagoBridge() {
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  const url = params.get("url") ?? "";
  const token = params.get("token") ?? "";
  /*
   * Nombre del campo que espera el primer salto. Transbank usa `TBK_TOKEN`;
   * Mercado Pago no usa formulario. Se recibe por query para no atar el puente
   * a un proveedor.
   */
  const field = params.get("field") ?? "TBK_TOKEN";
  const method = (params.get("method") ?? "GET").toUpperCase();

  useEffect(() => {
    if (!url) {
      setError("No recibimos la dirección de pago. Vuelve a iniciar el registro.");
      return;
    }

    if (method === "GET") {
      window.location.href = url;
      return;
    }

    /*
     * POST: el formulario ya está montado con la acción y el token. Enviarlo
     * aquí evita tener que esperar a un clic del usuario.
     *
     * Los saltos siguientes los sigue el navegador solo: cada respuesta es un
     * HTML con su propio `<form>` de autoenvío y su `<script>` que llama a
     * `submit()`.
     */
    formRef.current?.submit();
  }, [method, url]);

  if (error) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-bold text-white">No pudimos abrir el pago</h1>
        <p className="mt-3 text-sm text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <>
      {method === "POST" ? (
        <form ref={formRef} action={url} method="POST">
          <input type="hidden" name={field} value={token} />
        </form>
      ) : null}

      <div className="w-full max-w-md text-center">
        <div
          aria-hidden
          className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500"
        />
        <p className="text-sm text-gray-400">Te estamos llevando al pago seguro…</p>
      </div>
    </>
  );
}

/**
 * Mismo patrón que `/login`: `useSearchParams` exige un `<Suspense>` o el
 * prerender de Next falla con "should be wrapped in a suspense boundary".
 */
export default function PagoPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">Preparando el pago…</p>}>
      <PagoBridge />
    </Suspense>
  );
}
