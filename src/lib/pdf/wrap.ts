// Helpers de wrapping para PDFs generados con pdf-lib.
//
// El wrap de pdf-lib es por longitud de caracteres, no por ancho real, porque
// el tipografiado de la export usa un mono-ish de tamaño fijo y la grilla
// trabaja con un `maxLength` por columna. Eso obliga a manejar dos casos
// que `String.split(" ")` solo no cubre:
//   1. Palabra única más larga que `maxLength` (URL, hash, email pegado): si
//      no se rompe duro, desborda visualmente la celda.
//   2. Saltos de línea explícitos del input (`\n` que vienen de
//      buildReservationNotes): hay que respetarlos antes de wrappear, sino
//      el alto calculado del card no contempla las líneas extra y el texto
//      cae fuera del marco.

export function splitTextByLength(text: string, maxLength: number): string[] {
  if (maxLength <= 0) return [text];
  if (text.length <= maxLength) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  const pushHardBroken = (word: string) => {
    // Palabra sola más larga que la celda: cortarla en chunks. No usamos
    // guion al final porque puede confundirse con un valor real (códigos,
    // emails). Visualmente el chunking ya indica continuidad.
    for (let i = 0; i < word.length; i += maxLength) {
      lines.push(word.slice(i, i + maxLength));
    }
  };

  for (const word of words) {
    if (word.length > maxLength) {
      if (current) {
        lines.push(current);
        current = "";
      }
      pushHardBroken(word);
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export function wrapText(text: string, maxLength: number): string[] {
  return text.split("\n").flatMap((line) => splitTextByLength(line, maxLength));
}
