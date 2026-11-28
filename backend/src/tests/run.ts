// Configuración de pruebas: nunca apunta a la base institucional.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/smartdesk_test";
process.env.BCRYPT_ROUNDS = "10";

await import("../classifier/rules.test.js");
await import("../importer/whatsapp.test.js");
await import("../classifier/context.test.js");
await import("../classifier/import-scope.test.js");
await import("../classifier/v4/v4.test.js");
await import("../teachers/matching.test.js");
await import("../teachers/excel.test.js");
await import("../lib/validation.test.js");
await import("../lib/pagination.test.js");
await import("../auth/password.test.js");
