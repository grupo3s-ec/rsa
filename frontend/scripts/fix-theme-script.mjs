/**
 * Post-proceso del handler.mjs generado por @opennextjs/cloudflare.
 *
 * Problema: wrangler usa esbuild con keepNames, lo que inyecta __name() dentro
 * del cuerpo de la función `c` de next-themes. Cuando el Worker llama a
 * c.toString() para generar el script inline del HTML, el navegador recibe código
 * que referencia __name() sin que esté definido → crash antes de que React cargue.
 *
 * Solución: extraer la función `c` en el estado LIMPIO (antes de que wrangler
 * la procese con esbuild), y reemplazar `c.toString()` con ese string estático.
 * Un string literal no es transformado por esbuild → el navegador recibe código limpio.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const handlerPath = join(__dirname, '../.open-next/server-functions/default/handler.mjs');

let handler;
try {
  handler = readFileSync(handlerPath, 'utf8');
} catch {
  console.error('✗ handler.mjs no encontrado — ejecuta opennextjs-cloudflare build primero');
  process.exit(1);
}

// Extraer la función `c` del código fuente limpio (patrón reconocible de next-themes)
const cFnMatch = handler.match(/c=(\(a2,b2,c2,d2,e2,f2,g2,h2\)=>\{.*?\}catch\{\})/s);
if (!cFnMatch) {
  console.warn('⚠ Patrón de función c de next-themes no encontrado — handler puede haber cambiado');
  process.exit(0);
}
const cFnBody = cFnMatch[1];

// Reemplazar `c.toString()` con el string literal de la función limpia
const PATTERN = 'c.toString()';
const occurrences = (handler.match(/c\.toString\(\)/g) || []).length;

if (occurrences === 0) {
  console.warn('⚠ c.toString() no encontrado en handler.mjs — nada que parchear');
  process.exit(0);
}

// El JSON.stringify agrega las comillas y escapa correctamente el string
const staticFnStr = JSON.stringify(cFnBody);
handler = handler.replaceAll(PATTERN, staticFnStr);

writeFileSync(handlerPath, handler);
console.log(`✓ fix-theme-script: ${occurrences} ocurrencia(s) de c.toString() reemplazadas con string estático`);
