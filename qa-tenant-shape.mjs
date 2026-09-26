// QA: comprobar que /onboarding/site reconoce la sesion del REGISTRO.
//
// Simula lo que el registro deja en localStorage. Antes del fix, `user` iba
// plano (sin `tenant`), y la pagina se quedaba en "Cargando...".
export default async function run(page, ui) {
  const resultados = [];

  // --- Caso A: como guardaba ANTES el registro (user plano, sin tenant) ---
  await page.goto("http://localhost:3001/login", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.setItem("accessToken", "token-de-prueba");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "u1",
        fullName: "QA",
        email: "qa@test.cl",
        role: "owner",
      }),
    );
  });
  await page.goto("http://localhost:3001/onboarding/site", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(3000);
  const bodyA = await page.locator("body").innerText();
  resultados.push({
    caso: "A: user SIN tenant (forma antigua)",
    muestraCargando: bodyA.includes("Cargando"),
    url: page.url(),
  });

  // --- Caso B: como guarda AHORA el registro (user CON tenant anidado) ---
  await page.evaluate(() => {
    localStorage.setItem("accessToken", "token-de-prueba");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "u1",
        fullName: "QA",
        email: "qa@test.cl",
        role: "owner",
        tenant: { id: "t1", name: "QA Negocio", slug: "qa-negocio" },
      }),
    );
  });
  await page.goto("http://localhost:3001/onboarding/site", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(3000);
  const bodyB = await page.locator("body").innerText();
  resultados.push({
    caso: "B: user CON tenant (forma nueva)",
    muestraFormulario: bodyB.includes("Crea tu sitio"),
    muestraCargando: bodyB.includes("Cargando"),
    url: page.url(),
  });

  return resultados;
}
