import { spawn } from "node:child_process";

const dev = spawn("npm", ["run", "dev"], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: process.platform === "win32",
});

dev.stdout.on("data", (data) => {
  const output = data.toString();

  process.stdout.write(output);

  // Detecta erros comuns do runtime para acionar o fluxo auto-fix
  if (
    output.includes("TypeError") ||
    output.includes("ReferenceError") ||
    output.includes("Unhandled")
  ) {
    // Mantém o log claro, mas sem quebrar o processo
    // (apenas orienta a usar o fluxo auto-fix)
    console.log("\n🚨 ERRO DETECTADO AUTOMATICAMENTE\n");
    console.log(`Use auto-fix.md com esse erro:\n\n${output}`);
  }
});

dev.stderr.on("data", (data) => {
  process.stderr.write(data.toString());
});

dev.on("exit", (code) => {
  console.log(`\n[dev-watch] Processo dev finalizado com código ${code ?? "desconhecido"}.`);
});