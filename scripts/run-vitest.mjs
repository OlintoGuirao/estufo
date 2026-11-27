/**
 * Roda o vitest com a letra do drive normalizada (Windows).
 *
 * O terminal do VS Code abre o projeto como "d:\…". O cache de módulos ESM
 * diferencia file:///d:/ de file:///D:/, então o runner do vitest era carregado
 * duas vezes e TODO teste falhava com
 * "Cannot read properties of undefined (reading 'config')".
 * Iniciando o processo em "D:\…" o problema some. Em Linux/macOS nada muda.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const require = createRequire(path.join(cwd, "package.json"));
const bin = path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs");

const child = spawn(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
