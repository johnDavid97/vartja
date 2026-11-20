import process from "node:process";

const MAX_STDIN_BYTES = 16 * 1024;
const USAGE = "Sikker bruk: send ett JSON-objekt med name, email og password via standard input til `npm run admin:bootstrap`.";

class BootstrapInputError extends Error {}

async function readBoundedInput(): Promise<unknown> {
  if (process.stdin.isTTY) {
    throw new BootstrapInputError(`${USAGE} Interaktiv inntasting er ikke implementert; ingen passord kan gis som argument eller miljøvariabel.`);
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_STDIN_BYTES) throw new BootstrapInputError("Inndata er for stor.");
    chunks.push(buffer);
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new BootstrapInputError("Inndata må være gyldig JSON.");
  }
}

function parseInput(value: unknown): { name: string; email: string; password: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BootstrapInputError("Inndata må være ett JSON-objekt.");
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(",") !== "email,name,password") {
    throw new BootstrapInputError("JSON-objektet må inneholde nøyaktig name, email og password.");
  }
  if (typeof record.name !== "string" || typeof record.email !== "string" || typeof record.password !== "string") {
    throw new BootstrapInputError("name, email og password må være tekst.");
  }

  return { name: record.name, email: record.email, password: record.password };
}

async function main(): Promise<void> {
  if (process.argv.length !== 2) {
    throw new BootstrapInputError(`Argumenter er ikke tillatt. ${USAGE}`);
  }

  const input = parseInput(await readBoundedInput());
  if (!process.env.DATABASE_URL?.trim() || !process.env.PAYLOAD_SECRET?.trim()) {
    throw new BootstrapInputError("DATABASE_URL og PAYLOAD_SECRET må være satt i runtime-miljøet.");
  }

  const [{ default: configPromise }, { bootstrapAdministrator, BootstrapAlreadyInitializedError }, payloadModule] = await Promise.all([
    import("../payload.config"),
    import("../features/admin-security/bootstrap"),
    import("payload"),
  ]);
  const config = await configPromise;
  config.logger = { options: { level: "silent" } } as typeof config.logger;

  let payload: Awaited<ReturnType<typeof payloadModule.getPayload>> | undefined;
  try {
    payload = await payloadModule.getPayload({ config: Promise.resolve(config), key: "admin-bootstrap" });
    await bootstrapAdministrator(payload, input);
  } catch (error) {
    if (error instanceof BootstrapAlreadyInitializedError) {
      throw new BootstrapInputError("Administratoroppsett er allerede fullført.");
    }
    if (error instanceof payloadModule.ValidationError) {
      throw new BootstrapInputError("Ugyldige administratoropplysninger. Kontroller e-post, navn og passordkrav.");
    }
    throw error;
  } finally {
    await payload?.destroy().catch(() => undefined);
  }
}

// Native CMS/editor dependencies may retain background handles after destroy(). This is a
// one-shot operator command: finish only after cleanup and flushing its safe status message.
main().then(() => {
  process.stdout.write("Administrator opprettet.\n", () => process.exit(0));
}).catch((error: unknown) => {
  const message = error instanceof BootstrapInputError
    ? error.message
    : "Administrator kunne ikke opprettes. Kontroller runtime database- og secret-konfigurasjonen.";
  process.stderr.write(`${message}\n`, () => process.exit(1));
});
