// Application entry point (ESM)
//
// Wires together the Express app: middleware (body parsing, CORS,
// cookies, sessions), background cron jobs, and route groups.

import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

// Load env first — before anything reads process.env
dotenv.config();

// Cron jobs — importing them starts the schedulers
import "./jobs/dateStatusJob.js";
import "./jobs/camsIngestionJob.js";
import "./jobs/amfiIngestionJob.js";
import "./jobs/bseStarSchemeMasterIngestionJob.js";
import "./jobs/wbr22AumIngestionJob.js";
import "./jobs/karvyWbr22AumIngestionJob.js";
import "./jobs/karvyTransactionIngestionJob.js";

// Routers
import { clientsDocsRouter, swaggerSpec } from "./routes/clients.js";
import authRouter from "./routes/authentication.js";
import taskRouter from "./routes/tasks.js";
import leadRouter from "./routes/leads.js";
import companyAumRouter from "./routes/companyAum.js";
import analyticsRouter from "./routes/analytics.js";

const app = express();
const port = process.env.PORT || 3000;

// ----------------------------------------------------------------------------
// Middleware
// ----------------------------------------------------------------------------

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  cors({
    origin: ["http://localhost:5173" , `http://localhost:${process.env.PORT}`],
    credentials: true,
  })
);

app.use(cookieParser(process.env.SECRET));

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ----------------------------------------------------------------------------
// Swagger API documentation
// ----------------------------------------------------------------------------

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    swaggerOptions: {
      docExpansion: "list",
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  })
);

// Mounts the router that exposes /api-docs.json and any doc-related routes
app.use(clientsDocsRouter);

// memory.js

setInterval(() => {
  const m = process.memoryUsage();

  console.clear();

  console.table({
    RSS_MB: (m.rss / 1024 / 1024).toFixed(2),
    HeapUsed_MB: (m.heapUsed / 1024 / 1024).toFixed(2),
    HeapTotal_MB: (m.heapTotal / 1024 / 1024).toFixed(2),
    External_MB: (m.external / 1024 / 1024).toFixed(2)
  });
}, 5000);

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

app.get("/", (req, res) => {
  res.status(200).send({ message: "Server is functional" });
});

app.use("/api/auth", authRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/leads", leadRouter);
app.use("/api/company-aum", companyAumRouter);

// Business analytics — mounted on both prefixes
app.use("/api/analytics", analyticsRouter);
app.use("/analytics", analyticsRouter);

// ----------------------------------------------------------------------------
// Central error handling
// ----------------------------------------------------------------------------

app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({
    error: err.name || "Error",
    message: err.message || "Internal server error",
  });
});

app.listen(port, () => {
  console.log(`App listening at port http://localhost:${port}`);
});