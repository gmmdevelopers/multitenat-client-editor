"use client";

import { Lock } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { canEditSection } from "@/lib/role-routing";

/**
 * Aviso de "solo lectura" para las secciones que el rol no puede editar.
 *
 * ## Por que un aviso y no esconder la pantalla
 *
 * El `receptionist` **necesita ver** servicios, profesionales y horarios para
 * atender (responder precios, decir quien atiende un sabado). Ocultarle la
 * seccion le quitaria informacion que ya es publica en la web del negocio.
 *
 * Lo que no puede es **cambiarla**. Asi que ve el contenido y, en lugar de los
 * botones de edicion, este aviso: explica **por que** no puede y **a quien**
 * pedirselo. Un boton deshabilitado sin explicacion haria pensar que la app
 * esta rota; un 403 seco, que le falta un permiso que en realidad es una
 * decision del negocio.
 *
 * ## Uso
 *
 * Envolver la seccion editable. `sectionKey` es el mismo `key` del menu
 * (`services`, `hours`...), que es lo que consulta `canEditSection`.
 *
 * ```tsx
 * <ReadOnlySection sectionKey="services">
 *   <BotonGuardar />
 * </ReadOnlySection>
 * ```
 *
 * Si el rol SI puede editar, el componente devuelve los hijos tal cual y no
 * pinta nada: quien lo usa no necesita comprobar el rol por su cuenta.
 */
export function ReadOnlySection({
  sectionKey,
  children,
}: {
  sectionKey: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  // Sin usuario no se puede decidir: se deja pasar. La pantalla entera esta
  // detras de la sesion, asi que este caso no deberia ocurrir.
  if (!user) return <>{children}</>;

  if (canEditSection(user.role, sectionKey)) {
    return <>{children}</>;
  }

  return <ReadOnlyNotice />;
}

/**
 * El aviso, suelto.
 *
 * Se expone aparte porque hay pantallas donde no se puede envolver un bloque
 * (por ejemplo, cuando lo que sobra es una accion concreta y no un formulario
 * entero). Ahi se usa este componente directamente.
 */
export function ReadOnlyNotice() {
  return (
    <div
      data-read-only-notice="true"
      className="flex items-start gap-3 rounded-xl border border-line bg-surface-raised/50 p-4"
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted" />

      <div>
        <p className="text-xs font-semibold text-foreground">Solo lectura</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
          Puedes consultar esta información, pero no modificarla. Si necesitas
          un cambio, contáctale al administrador de tu negocio.
        </p>
      </div>
    </div>
  );
}
