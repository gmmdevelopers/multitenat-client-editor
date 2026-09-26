// Verifica la mascara del telefono y el flujo del registro en el navegador.
export default async function run(page, ui) {
  const pasos = [];

  // --- Paso 1: cuenta ---
  await page.locator("#fullName").fill("Ana Prueba");
  await page.locator("#email").fill("ana.prueba@ejemplo.cl");
  await page.locator("#password").fill("ClaveSegura123");
  const confirm = page.locator("#confirmPassword");
  if (await confirm.count()) {
    await confirm.fill("ClaveSegura123");
  }
  await page
    .getByRole("button", { name: /continuar/i })
    .first()
    .click();
  await page.waitForTimeout(2000);

  // --- Paso 2: negocio ---
  const paso2 = await ui.snapshot({ full: true });
  pasos.push({
    paso: "2-negocio",
    tieneCampoTelefono:
      paso2.includes("Telefono") || paso2.includes("Teléfono"),
  });

  // La mascara: se escriben digitos sueltos y se comprueba el valor formateado.
  const phone = page.locator("#phone");
  await phone.fill("");
  await phone.type("999999999", { delay: 30 });
  const valorConMascara = await phone.inputValue();

  // Pegar el numero completo con +56 debe dar el mismo resultado.
  await phone.fill("");
  await phone.type("+56999999999", { delay: 20 });
  const valorPegado = await phone.inputValue();

  pasos.push({
    paso: "mascara-telefono",
    escrito: valorConMascara,
    pegado: valorPegado,
    prefijoVisible: (await page.locator("text=+56").count()) > 0,
  });

  return { pasos, url: page.url() };
}
