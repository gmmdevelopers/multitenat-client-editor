// QA: con la sesion que deja el REGISTRO, el proxy deja pasar a /onboarding/site?
//
// El proxy exige la COOKIE accessToken. Antes, el registro solo escribia en
// localStorage, asi que el proxy no veia sesion y mandaba a /login.
export default async function run(page, ui) {
  const resultados = [];

  await page.goto("http://localhost:3001/login", { waitUntil: "networkidle" });

  // --- Caso A: como lo hacia ANTES (solo localStorage, sin cookie) ---
  await page.evaluate(() => {
    document.cookie = "accessToken=; path=/; max-age=0";
    document.cookie = "x-org-slug=; path=/; max-age=0";
    localStorage.setItem("accessToken", "token-falso");
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
  await page.waitForTimeout(2000);
  resultados.push({
    caso: "A: solo localStorage (forma antigua)",
    acaboEn: page.url().replace("http://localhost:3001", ""),
    llegoAlOnboarding: !page.url().includes("/login"),
  });

  // --- Caso B: como lo hace AHORA (persistToken escribe cookie + localStorage) ---
  await page.evaluate(() => {
    const token = "token-de-prueba-qa";
    localStorage.setItem("accessToken", token);
    document.cookie = `accessToken=${token}; path=/; max-age=604800; samesite=lax`;
    document.cookie =
      "x-org-slug=qa-negocio; path=/; max-age=604800; samesite=lax";
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
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  resultados.push({
    caso: "B: cookie + localStorage (forma nueva)",
    acaboEn: page.url().replace("http://localhost:3001", ""),
    llegoAlOnboarding: !page.url().includes("/login"),
    muestraFormulario: body.includes("Crea tu sitio"),
    texto: body.slice(0, 160).replace(/\n+/g, " | "),
  });

  return resultados;
}
