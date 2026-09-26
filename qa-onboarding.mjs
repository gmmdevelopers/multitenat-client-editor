// QA: que pasa en /onboarding/site SIN sesion valida?
export default async function run(page, ui) {
  // Sin token en localStorage: AuthContext deja user/tenant en null.
  await page.goto("http://localhost:3001/onboarding/site", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(3500);

  const tree = await ui.snapshot({ full: true });
  const body = await page.locator("body").innerText();

  return {
    urlTras_esperar: page.url(),
    muestraCargando: body.includes("Cargando"),
    redirigioALogin: page.url().includes("/login"),
    texto: body.slice(0, 300),
    tree: tree.slice(0, 500),
  };
}
