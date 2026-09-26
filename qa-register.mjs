// QA del registro: mascara de telefono y link al registro desde el login.
export default async function run(page, ui) {
  const steps = [];

  // --- Login: existe el link al registro? ---
  await page.goto("http://localhost:3001/login", { waitUntil: "networkidle" });
  const loginTree = await ui.snapshot({ full: true });
  steps.push({
    step: "login",
    tieneLinkRegistro: loginTree.includes("Crear una"),
    tieneVerPassword: loginTree.includes("Ver"),
    tieneOrganizacion: loginTree.includes("Organización"),
  });

  // --- Ir al registro desde el link ---
  await page.getByRole("link", { name: "Crear una" }).click();
  await page.waitForURL("**/register", { timeout: 15000 });
  await page.waitForTimeout(1500);
  steps.push({ step: "navegacion", url: page.url() });

  // --- Paso 1: cuenta ---
  const s1 = await ui.snapshot();
  steps.push({ step: "paso1", campos: s1 });

  await page.locator("#fullName").fill("Test QA");
  await page.locator("#email").fill("qa-telefono@test.cl");
  await page.locator("#password").fill("ClaveSegura123");
  const confirm = page.locator("#confirmPassword");
  if (await confirm.count()) await confirm.fill("ClaveSegura123");

  const next1 = page
    .getByRole("button", { name: /Continuar|Siguiente/ })
    .first();
  await next1.click();
  await page.waitForTimeout(1500);

  // --- Paso 2: telefono con mascara ---
  const phone = page.locator("#phone");
  if (!(await phone.count())) {
    return {
      steps,
      error: "no se encontro el campo #phone",
      tree: await ui.snapshot({ full: true }),
    };
  }

  const casos = ["912345678", "+56912345678", "9 1234 5678"];
  const resultados = [];

  for (const entrada of casos) {
    await phone.fill("");
    await phone.type(entrada, { delay: 15 });
    await page.waitForTimeout(250);
    resultados.push({ entrada, valor: await phone.inputValue() });
  }

  // El prefijo +56 debe estar visible y NO dentro del input.
  const prefijo = await page
    .locator("text=+56")
    .first()
    .textContent()
    .catch(() => null);

  steps.push({
    step: "telefono",
    prefijoVisible: prefijo,
    conversiones: resultados,
  });

  return { steps, url: page.url() };
}
