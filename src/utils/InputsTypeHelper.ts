export const isColorProp = (key: string, value: any) => {
  // Una URL de imagen NO es un color, aunque la clave lleve "background":
  // `backgroundImageSrc` caeria aqui por el prefijo `background`.
  if (isImageProp(key, value)) return false;

  const lowerKey = key.toLowerCase();
  const matchesColorName =
    lowerKey.includes("color") ||
    lowerKey.includes("bg") ||
    lowerKey.includes("background") ||
    lowerKey.includes("fill") ||
    lowerKey.includes("stroke") ||
    lowerKey.includes("bordercolor");

  if (matchesColorName) return true;

  if (typeof value === "string") {
    const val = value.trim();
    return (
      val.startsWith("#") || val.startsWith("rgb") || val.startsWith("hsl")
    );
  }

  return false;
};

/**
 * Campos cuyo valor es una imagen.
 *
 * Se mira el nombre de la prop y tambien el propio valor: hay metas antiguos
 * que declaran una URL de imagen con `control: 'text'`, asi que fiarse solo del
 * nombre dejaria fuera casos validos.
 *
 * Se exige que el valor sea una URL http(s) para no confundir un color con una
 * imagen: `backgroundColor` se llama parecido pero vale `#FFF7ED`.
 */
export const isImageProp = (key: string, value: any) => {
  if (typeof value !== "string" || !value.trim()) return false;

  const val = value.trim();

  // Tiene que ser una URL absoluta: descarta colores, rutas y texto libre.
  if (!/^https?:\/\//i.test(val)) return false;

  const lowerKey = key.toLowerCase();
  const matchesImageName =
    lowerKey.includes("image") ||
    lowerKey.includes("src") ||
    lowerKey.includes("photo") ||
    lowerKey.includes("avatar") ||
    lowerKey.includes("logo") ||
    lowerKey.includes("banner") ||
    lowerKey.includes("cover");

  const looksLikeImageFile = /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i.test(val);

  return matchesImageName || looksLikeImageFile;
};

export const isIconProp = (key: string) => {
  const lowerKey = key.toLowerCase();
  return lowerKey.includes("icon");
};

export const isLinkProp = (key: string) => {
  const lowerKey = key.toLowerCase();
  return (
    lowerKey === "href" || lowerKey.includes("link") || lowerKey.includes("url")
  );
};
