import net from 'node:net';

const DEFAULT_PORT = 5432;
/** Preferido quando 5432 já é Postgres do host / Docker. Depois: faixa dedicada ao embutido. */
const CANDIDATE_PORTS = [55432, 55433, 55434, 55435, 55436, DEFAULT_PORT] as const;

export async function isPortFree(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ port, host }, () => {
      server.close(() => resolve(true));
    });
  });
}

/** Precheck RC2-PG: tenta 55432+ (embutido) e por último 5432. */
export async function allocatePostgresPort(): Promise<number> {
  for (const port of CANDIDATE_PORTS) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(
    `PG_PORT_UNAVAILABLE: nenhuma porta livre em ${CANDIDATE_PORTS.join(', ')} ` +
      '(pare Docker/SaaS Local ou outro Postgres que use essas portas)',
  );
}
