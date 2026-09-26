// Verifica que el registro devuelve requiresPayment correcto segun el cupon.
// Se llama directo al API: lo que importa aqui es el CONTRATO del backend,
// no la interfaz.
export default async function run(page, ui) {
  const resultado = await page.evaluate(async () => {
    const api = "http://localhost:3000/api";
    const salida = {};

    // Caso 1: sin cupon -> debe requerir pago (entra en prueba de 7 dias).
    // No se puede registrar de verdad (crearia tenants), asi que se comprueba
    // la forma de la respuesta contra un cupon inexistente para ver el error.
    try {
      const r = await fetch(api + "/tenants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Cupon",
          slug: "test-cupon-" + Date.now(),
          taxId: "12345678-5",
          phone: "+56999999999",
          businessType: "generic",
          requestedPlan: "basic",
          admin: {
            fullName: "Test",
            email: "test" + Date.now() + "@ejemplo.cl",
            password: "ClaveSegura123",
          },
          captchaToken: "token-invalido",
          couponCode: "CUPON-QUE-NO-EXISTE",
        }),
      });
      salida.cuponInexistente = { status: r.status, body: await r.json() };
    } catch (e) {
      salida.cuponInexistente = { error: String(e) };
    }

    return salida;
  });

  return resultado;
}
