import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import pinoHttp from "pino-http";
import { config } from "./config";
import path from "path";
import { fileURLToPath } from "url";

import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { clientRouter } from "./routes/clients";
import { bookingRouter } from "./routes/bookings";
import { metaRouter } from "./routes/meta";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: false,
    }),
  );
  app.use(pinoHttp());
  app.use(morgan("tiny"));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/clients", clientRouter);
  app.use("/api/meta", metaRouter);
  app.use("/api/bookings", bookingRouter);

  
  app.get('/', (req, res) => {
    res.send('OK');
  });


  return app;
}

