import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const migrationsDir = resolve("drizzle/migrations");

const canonicalOrder = [
  "0000_radarshop_core_schema.sql",
  "0001_foundation_security.sql",
  "0002_plan_usage.sql",
  "0003_billing_mercado_pago.sql",
  "0004_multi_gateway_billing.sql",
  "0005_multi_gateway_readiness.sql",
  "0006_ingestion_observability.sql",
  "0007_tiktok_shop_oauth_storage.sql",
  "0008_tiktok_showcase_private_cache.sql",
  "0009_tiktok_opportunity_tracking.sql",
];

const legacyAliases = new Map([
  ["0001_billing_mercado_pago.sql", "0003_billing_mercado_pago.sql"],
  ["0002_0004_multi_gateway_billing.sql", "0004_multi_gateway_billing.sql"],
]);

const normalizeSql = (value) => value.replace(/\r\n/g, "\n").trimEnd();

async function main() {
  const entries = await readdir(migrationsDir);
  const sqlFiles = entries.filter((file) => file.endsWith(".sql")).sort();

  const missingCanonical = canonicalOrder.filter((file) => !sqlFiles.includes(file));
  if (missingCanonical.length) {
    throw new Error(
      `Migrations canônicas ausentes: ${missingCanonical.join(", ")}`,
    );
  }

  const allowedFiles = new Set([...canonicalOrder, ...legacyAliases.keys()]);
  const unknownSqlFiles = sqlFiles.filter((file) => !allowedFiles.has(file));

  if (unknownSqlFiles.length) {
    throw new Error(
      [
        "Há migrations SQL que ainda não foram registradas na ordem canônica.",
        "Atualize scripts/validate-migrations.mjs e drizzle/migrations/README.md antes de prosseguir:",
        unknownSqlFiles.join(", "),
      ].join("\n"),
    );
  }

  for (const [legacy, canonical] of legacyAliases) {
    if (!sqlFiles.includes(legacy)) {
      throw new Error(
        `Alias legado esperado não encontrado: ${legacy}. Não remova migrations já publicadas sem confirmar o histórico do banco.`,
      );
    }

    const [legacySql, canonicalSql] = await Promise.all([
      readFile(resolve(migrationsDir, legacy), "utf8"),
      readFile(resolve(migrationsDir, canonical), "utf8"),
    ]);

    if (normalizeSql(legacySql) !== normalizeSql(canonicalSql)) {
      throw new Error(
        `O alias legado ${legacy} divergiu da migration canônica ${canonical}. Isso pode quebrar instalações limpas.`,
      );
    }
  }

  const journal = JSON.parse(
    await readFile(resolve(migrationsDir, "meta/_journal.json"), "utf8"),
  );
  const journalTags = Array.isArray(journal.entries)
    ? journal.entries.map((entry) => entry.tag).filter(Boolean)
    : [];

  for (const tag of journalTags) {
    const filename = `${tag}.sql`;
    if (!sqlFiles.includes(filename)) {
      throw new Error(
        `O journal do Drizzle referencia ${filename}, mas o arquivo não existe.`,
      );
    }
  }

  const runbook = await readFile(resolve("docs/PRODUCTION_RUNBOOK.md"), "utf8");
  let lastIndex = -1;

  for (const migration of canonicalOrder.slice(1)) {
    const index = runbook.indexOf(migration);
    if (index === -1) {
      throw new Error(
        `O runbook de produção não menciona a migration canônica ${migration}.`,
      );
    }
    if (index < lastIndex) {
      throw new Error(
        `A ordem das migrations no runbook divergiu da ordem canônica em ${migration}.`,
      );
    }
    lastIndex = index;
  }

  process.stdout.write(
    `Migrations validadas: ${canonicalOrder.length} canônicas + ${legacyAliases.size} aliases legados.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `Falha na integridade das migrations: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
