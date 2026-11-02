import { redirect } from "next/navigation";

/**
 * `/register/gracias` sin id.
 *
 * Existe solo para no dejar un 404. La pagina real es `[alta]/page.tsx`, que
 * necesita el id del registro para poder consultar su estado.
 *
 * Toda la logica vive alli: esta redirige para no duplicar la pantalla (dos
 * copias del mismo JSX se desincronizarian a la primera de cambio).
 */
export default function RegisterThanksIndexPage() {
  redirect("/login");
}
