<<<<<<< Updated upstream
import 'dotenv/config';import express from 'express';import cors from 'cors';import helmet from 'helmet';import imports from './routes/imports.js';import incidents from './routes/incidents.js';import reports from './routes/reports.js';
const app=express();app.use(helmet());app.use(cors({origin:process.env.FRONTEND_ORIGIN??'http://localhost:5173'}));app.use(express.json({limit:'2mb'}));app.get('/api/health',(_q,s)=>s.json({ok:true}));app.use('/api/imports',imports);app.use('/api/incidents',incidents);app.use('/api/reports',reports);app.listen(Number(process.env.PORT??3001),()=>console.log('API lista'));
=======
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./lib/http.js";
import { logger } from "./lib/logger.js";
import { attachSession, csrfGuard, originGuard } from "./auth/middleware.js";
import auth from "./auth/routes.js";
import health from "./routes/health.js";
import imports from "./routes/imports.js";
import incidents from "./routes/incidents.js";
import reports from "./routes/reports.js";
import dashboard from "./routes/dashboard.js";
import categories from "./routes/categories.js";
import teachers from "./teachers/routes.js";
import users from "./routes/users.js";
import configRoutes from "./routes/config.js";
import classifier from "./routes/classifier.js";
import drive from "./routes/drive.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = new Set([env.FRONTEND_ORIGIN]);
    callback(null, allowed.has(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token"],
}));

app.use(express.json({ limit: `${env.MAX_UPLOAD_MB}mb` }));
app.use(attachSession);
app.use(originGuard);
app.use(csrfGuard);

app.use("/api/health", health);
app.use("/api/auth", auth);
app.use("/api/imports", imports);
app.use("/api/incidents", incidents);
app.use("/api/reports", reports);
app.use("/api/dashboard", dashboard);
app.use("/api/categories", categories);
app.use("/api/teachers", teachers);
app.use("/api/users", users);
app.use("/api/config", configRoutes);
app.use("/api/classifier", classifier);
app.use("/api/drive", drive);

app.use(notFoundHandler);
app.use(errorHandler);

const port = env.PORT;
const server = app.listen(port, () => {
  logger.info(`API TI SmartDesk escuchando en puerto ${port} (${env.NODE_ENV})`);
});
server.on("error", (error) => {
  logger.error("No se pudo iniciar la API", { message: error.message });
  process.exitCode = 1;
});

export default app;
>>>>>>> Stashed changes
