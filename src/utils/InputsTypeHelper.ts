export const isColorProp = (key: string, value: any) => {
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
