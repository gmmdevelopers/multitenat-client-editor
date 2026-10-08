"use client";

import { useEffect, useState } from "react";
import { AppointmentScheduler } from "@multitenant/design-system";
import type {
  SchedulerOpeningDay,
  SchedulerProfessional,
  SchedulerService,
} from "@multitenant/design-system";

import {
  bookPublicAppointment,
  getPublicAvailability,
  getPublicDepositPolicy,
  listPublicProfessionals,
  listPublicServices,
} from "@/lib/api/scheduling";
import { getPublicBusinessHours } from "@/lib/api/public-schedule";
import { getErrorMessage } from "@/lib/api/errors";

interface CurrentSchedulerProps {
  eyebrow?: string;
  title: string;
  description?: string;
  accentColor?: string;
  /**
   * @deprecated La duracion la define el servicio elegido.
   *
   * Se acepta y se IGNORA, para no romper paginas ya guardadas que la traigan.
   */
  durationInMinutes?: number;
  /** @deprecated El nombre sale del servicio elegido. */
  serviceLabel?: string;
}

/**
 * Conecta el `AppointmentScheduler` del design system con la API publica.
 *
 * El design system no hace HTTP, asi que este wrapper vive en el cliente y es
 * lo que se inyecta en las paginas de agenda via `schedulerSlot`.
 */
export function ConnectedScheduler({
  eyebrow,
  title,
  description,
  accentColor,
}: CurrentSchedulerProps) {
  const [services, setServices] = useState<SchedulerService[]>([]);
  const [professionals, setProfessionals] = useState<SchedulerProfessional[]>([]);
  const [openingHours, setOpeningHours] = useState<SchedulerOpeningDay[]>([]);
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  /**
   * Politica del negocio, para EXPLICARLA en la lista de servicios.
   *
   * Se pasa con `amountFor` y no con un monto calculado: la lista ensena el
   * abono de TODOS los servicios a la vez, antes de que el paciente elija. Con
   * un monto unico, todos saldrian con la cifra del servicio ya seleccionado.
   */
  const [paymentInfo, setPaymentInfo] = useState<{
    requiresPayment: boolean;
    percentage: number;
    amountFor: (servicePrice: number) => number;
  } | null>(null);
  /** Politica de cobro del negocio, o `null` mientras carga. */
  const [policy, setPolicy] = useState<{
    requiresPayment: boolean;
    percentage: number;
    amountFor: (servicePrice: number) => number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Las tres listas se piden juntas: el agendador necesita todas para el paso
    // 1, y pedirlas en serie retrasaria el primer pintado sin motivo.
    void Promise.all([
      listPublicServices(),
      listPublicProfessionals(),
      getPublicBusinessHours(),
      getPublicDepositPolicy(),
    ])
      .then(([serviceList, professionalList, hours, policy]) => {
        setServices(
          serviceList.map((s) => ({
            id: s.id,
            name: s.name,
            durationInMinutes: s.durationInMinutes,
            // El precio lo necesita el componente para calcular el monto
            // cuando el negocio cobra al agendar.
            price: s.price,
          })),
        );
        setProfessionals(
          professionalList.map((p) => ({
            id: p.id,
            fullName: p.fullName,
            serviceIds: p.serviceIds,
          })),
        );
        setOpeningHours(hours);
        setPolicy(policy);
        // La politica se pasa tal cual: el componente calcula el abono de cada
        // servicio con `amountFor`.
        setPaymentInfo(policy);
      })
      .catch((err) =>
        setError(
          getErrorMessage(err, "No pudimos cargar la información de la agenda."),
        ),
      );
  }, []);

  /**
   * Monto que se le pedira al paciente, segun el servicio elegido.
   *
   * Depende del servicio, y el servicio lo elige el paciente DENTRO del
   * agendador, asi que se recalcula cuando cambia: por eso el componente avisa
   * de la seleccion con `onServiceChange`.
   *
   * Con precio `0` (a convenir) no se pide nada, aunque el negocio tenga
   * politica de cobro: no hay porcentaje que calcular de cero.
   */
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedServiceId || !policy) {
      setPaymentAmount(null);
      return;
    }

    const service = services.find((s) => s.id === selectedServiceId);
    const price = service?.price ?? 0;

    // Con precio `0` (a convenir) no se pide nada aunque la politica cobre: de
    // cero no se puede calcular un porcentaje.
    const amount =
      policy.requiresPayment && price > 0 ? policy.amountFor(price) : 0;

    setPaymentAmount(amount > 0 ? amount : null);
  }, [selectedServiceId, services, policy]);

  if (error) {
    return (
      <section className="bg-[#ECF5FB] px-6 py-16 text-center">
        <p className="text-sm text-[#566593]">{error}</p>
      </section>
    );
  }

  return (
    <AppointmentScheduler
      eyebrow={eyebrow}
      title={title}
      description={description}
      accentColor={accentColor}
      services={services}
      professionals={professionals}
      openingHours={openingHours}
      paymentAmount={paymentAmount}
      paymentInfo={paymentInfo}
      onServiceChange={setSelectedServiceId}
      onLoadSlots={async ({ professionalId, serviceId, day }) => {
        /**
         * La ventana es el DIA COMPLETO, y el horario del negocio la recorta.
         *
         * Antes estaba fijada a `08:00-20:00` en el navegador, que ignoraba el
         * horario configurado: un negocio que abre de 09:00 a 18:00 veia la
         * ventana equivocada. El recorte real lo hace el backend con
         * `BusinessHours` (y respeta feriados y descansos), asi que aqui solo
         * hay que pedir el dia entero y dejar que el decida.
         *
         * Se construye en UTC a proposito: el backend compara instantes, y el
         * horario local se aplica alli con la zona del negocio.
         */
        const windowStartsAt = `${day}T00:00:00.000Z`;
        const windowEndsAt = `${day}T23:59:59.999Z`;

        const result = await getPublicAvailability({
          professionalId,
          serviceId,
          windowStartsAt,
          windowEndsAt,
          // Paso de 30 min: una rejilla mas fina daria demasiadas opciones y
          // una mas gruesa ocultaria horas utiles.
          stepInMinutes: 30,
        });

        return {
          slots: result.slots,
          closedReason: result.closedReason,
        };
      }}
      onConfirm={async ({ professionalId, serviceId, slot, patient }) => {
        // Sin `boxId`: el backend usa el primer consultorio activo.
        const booked = await bookPublicAppointment({
          professionalId,
          serviceId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          patient,
        });

        // Con pago pendiente, el componente lleva al paciente a Mercado Pago.
        // La cita queda `held` hasta que el webhook confirme el pago.
        return {
          paymentUrl: booked.paymentUrl,
          paymentAmount: booked.paymentAmount,
        };
      }}
    />
  );
}
