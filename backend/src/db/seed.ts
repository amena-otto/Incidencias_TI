
import { db, pool } from "./client.js";
import { categories } from "./schema.js";

type CategoryGroup =
  | "ti"
  | "asistencia"
  | "operaciones"
  | "infraestructura"
  | "seguridad"
  | "otros";

type CategorySeed = [
  name: string,
  group: CategoryGroup,
  description: string,
  keywords: string[]
];

const rows: CategorySeed[] = [
  ["TI · Redes e Internet", "ti", "Conectividad, Wi-Fi e Internet", ["internet", "wifi", "wi-fi", "conexión", "conexion", "red", "señal"]],
  ["TI · Equipos audiovisuales", "ti", "Proyectores, pantallas, HDMI y audio", ["proyector", "pantalla", "hdmi", "televisor", "parlante", "audio"]],
  ["TI · Hardware y periféricos", "ti", "Laptops, computadoras y periféricos", ["laptop", "computadora", "teclado", "mouse", "monitor"]],
  ["TI · Software y plataformas", "ti", "Sistemas, plataformas, accesos y correo", ["plataforma", "sistema", "jaguar", "correo", "contraseña", "acceso"]],
  ["TI · Impresoras", "ti", "Impresoras, tinta e impresión", ["impresora", "imprimir", "impresión", "tinta"]],
  ["Asistencia · Marcación y asistencia", "asistencia", "Marcación de entrada, salida y asistencia", ["marcación", "marcacion", "asistencia", "entrada", "salida"]],
  ["Infraestructura · Electricidad y mantenimiento", "infraestructura", "Electricidad, tomacorrientes e instalaciones", ["tomacorriente", "enchufe", "corriente", "electricidad", "mantenimiento"]],
  ["Operaciones · Apertura y acceso a ambientes", "operaciones", "Apertura de aulas, laboratorios y baños", ["apertura", "abrir", "laboratorio", "aula", "baños"]],
  ["Operaciones · Mobiliario y materiales", "operaciones", "Sillas, taburetes, materiales y mobiliario", ["sillas", "taburetes", "materiales", "mobiliario", "biopacks"]],
  ["Operaciones · Programación de laboratorios", "operaciones", "Programación y solicitudes de laboratorios", ["programación", "rol", "laboratorios"]],
  ["Operaciones · Limpieza y ambiente", "operaciones", "Limpieza y condiciones del ambiente", ["limpieza", "ruido", "ambiente"]],
  ["Seguridad · Salud y ambiente", "seguridad", "Riesgos sanitarios y seguridad", ["mercurio", "zancudos", "dengue", "riesgo"]],
  ["Otros · Solicitud de apoyo sin detalle", "otros", "Solicitudes que requieren revisión manual", ["apoyo", "ayuda", "solicitud"]]
];

try {
  for (const [name, group, description, keywords] of rows) {
    await db
      .insert(categories)
      .values({
        name,
        group,
        description,
        keywords
      })
      .onConflictDoUpdate({
        target: categories.name,
        set: {
          group,
          description,
          keywords,
          active: true
        }
      });
  }

  console.log(`Seed completado: ${rows.length} categorías.`);
} finally {
  await pool.end();
}
