/**
 * Service worker de las notificaciones del panel.
 *
 * ## Por que existe
 *
 * Es el unico que puede **recibir un push con el panel cerrado**. La pagina, sin
 * estar abierta, no ejecuta nada; este archivo si, lo despierta el navegador.
 *
 * ## Lo que NO hace: cachear
 *
 * No hay estrategia offline a proposito. El panel vive de datos que cambian
 * (agenda, chat) y servir una version vieja seria peor que no cargar: alguien
 * creeria que tiene la agenda del dia y le faltaria una cita. Usar una libreria
 * como Workbox solo para esto añadiria peso y una dependencia que hay que
 * mantener al dia.
 *
 * ## Este archivo NO es un modulo
 *
 * No tiene `import`: los service workers clasicos se registran como script y el
 * navegador lo ejecuta aislado. Todo lo que necesita llega en el evento.
 */

self.addEventListener("push", (event) => {
  /**
   * Sin `event.data` el navegador muestra un aviso generico.
   *
   * No deberia pasar (el backend siempre manda contenido cifrado), pero si la
   * clave de cifrado esta mal, un `data.json()` a ciegas lanzaria y el push
   * **se perderia sin rastro**. Con el respaldo, al menos se ve que algo paso.
   */
  let payload = {
    title: "Panel",
    body: "Tienes una notificación nueva.",
    data: { url: "/dashboard" },
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      // Se queda el respaldo de arriba.
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      /**
       * `tag`: un aviso del MISMO tema reemplaza al anterior.
       *
       * Sin esto, una agenda ocupada llenaria la bandeja con "cita nueva" x10.
       * Con el tag, la ultima reemplaza a la anterior del mismo id de cita.
       */
      tag: payload.data?.tag,
      /**
       * `renotify: false` con sonido.
       *
       * Reemplazar un aviso no debe volver a sonar si el tag es `undefined`
       * (todos los avisos sin tag comparten el mismo). `false` evita el
       * zumbido repetido, y el sonido normal ya lo pone el sistema.
       */
      renotify: false,
      /**
       * `requireInteraction`: el aviso NO desaparece solo.
       *
       * "Cita nueva" y "cita cancelada" son cosas que hay que ver. Un aviso que
       * se va a los 5 segundos mientras se atiende a un paciente es lo mismo que
       * no haberlo mandado.
       */
      requireInteraction: true,
      /**
       * `data` se lee en `notificationclick` para saber a que ruta abrir el
       * panel.
       */
      data: payload.data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? "/dashboard";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      /**
       * Si el panel ya esta abierto, se REUTILIZA esa pestaña.
       *
       * Abrir una nueva cada vez dejaria cinco pestañas del panel tras cinco
       * avisos, y la sesion se repite en todas. Se navega la que existe y se
       * enfoca.
       */
      for (const client of clientList) {
        if ("navigate" in client) {
          await client.navigate(url);
          await client.focus();
          return;
        }
      }

      await self.clients.openWindow(url);
    })(),
  );
});
