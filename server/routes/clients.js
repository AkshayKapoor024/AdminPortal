/**
 * DK Wealth Admin Portal — Consolidated API Documentation Router
 * ==============================================================
 * This file exists purely to host the OpenAPI 3.0 JSDoc annotations
 * for all admin-side endpoints. It also mounts the interactive
 * Swagger UI at /api-docs.
 *
 * NOTE: In production you should split the JSDoc blocks below back
 * into their source route files (analytics.js, tasks.js, auth.js,
 * companyAum.js, leads.js) so documentation lives next to code.
 * This consolidated version is provided as a single reference.
 */

import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

const router = express.Router();

// ============================================================================
// SWAGGER UI CONFIGURATION
// ============================================================================

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "DK Wealth Admin Portal API",
      version: "1.0.0",
      description: `
## Overview
REST API for the DK Wealth Admin Portal. Provides authentication,
task management, lead management, business analytics on AMC / Category
AUM, and WBR22 file import for company AUM ingestion.

## Authentication
All protected endpoints use **session-based authentication** (express-session
with a \`connect.sid\` cookie). You must first call \`POST /auth/login\` or
\`POST /auth/signup\`, then include the returned session cookie on all
subsequent requests.

Swagger UI handles this automatically in the browser — once you log in
through the UI, the session cookie is stored and reused.

## Sections
- **Authentication** — Signup, login, logout, session check
- **Tasks** — CRUD for admin tasks
- **Leads** — CRUD for sales leads (with document uploads)
- **Analytics** — AMC and Category AUM performance
- **Company AUM** — WBR22 file import for AUM ingestion
      `.trim(),
      contact: {
        name: "DK Wealth Engineering",
        email: "engineering@dkwealth.example.com",
      },
    },
    servers: [
      { url: "http://localhost:5000", description: "Development Server" },
      { url: "https://api.dkwealth.example.com", description: "Production Server" },
    ],
    tags: [
      { name: "Authentication", description: "Admin signup, login, logout, and session validation." },
      { name: "Tasks", description: "Create, update, list, fetch, and delete admin tasks." },
      { name: "Leads", description: "Create, update, list, fetch, and delete sales leads." },
      { name: "Analytics", description: "AMC and Category performance analytics over Company AUM data." },
      { name: "Company AUM", description: "Import WBR22 holdings files for company AUM ingestion." },
    ],
    components: {
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "connect.sid",
          description: "Session cookie set by `/auth/login` or `/auth/signup`. Automatically sent by the browser.",
        },
      },
      schemas: {
        // ---------- Common ----------
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Internal server error" },
            message: { type: "string", example: "Detailed error message" },
          },
        },
        UnauthorizedResponse: {
          type: "object",
          properties: { error: { type: "string", example: "Not authenticated" } },
        },
        ForbiddenResponse: {
          type: "object",
          properties: { error: { type: "string", example: "Not allowed to access this resource" } },
        },
        NotFoundResponse: {
          type: "object",
          properties: { error: { type: "string", example: "Resource not found" } },
        },

        // ---------- Auth ----------
        AdminUser: {
          type: "object",
          properties: {
            id: { type: "string", example: "0192b3c4-d5e6-7f89-a0b1-c2d3e4f5a6b7" },
            name: { type: "string", example: "Akshay Kapoor" },
            username: { type: "string", example: "akshay" },
            email: { type: "string", format: "email", example: "akshay@dkwealth.com" },
            role: { type: "string", example: "admin" },
            createdAt: { type: "string", format: "date-time", example: "2026-10-14T09:15:00.000Z" },
          },
        },
        SignupRequest: {
          type: "object",
          required: ["name", "username", "email", "password", "role"],
          properties: {
            name: { type: "string", example: "Akshay Kapoor" },
            username: { type: "string", example: "akshay" },
            email: { type: "string", format: "email", example: "akshay@dkwealth.com" },
            password: { type: "string", format: "password", minLength: 8, example: "StrongPass@123" },
            role: { type: "string", enum: ["admin", "manager", "viewer"], example: "admin" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "akshay@dkwealth.com" },
            password: { type: "string", format: "password", example: "StrongPass@123" },
          },
        },
        AuthSuccessResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "User logged in Successfully" },
            user: { $ref: "#/components/schemas/AdminUser" },
          },
        },
        IsAuthenticatedResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Authenticated" },
            user: { $ref: "#/components/schemas/AdminUser" },
          },
        },

        // ---------- Task ----------
        Task: {
          type: "object",
          properties: {
            id: { type: "string", example: "0192b3c4-d5e6-7f89-a0b1-c2d3e4f5a6b8" },
            title: { type: "string", example: "Follow up with HDFC AMC" },
            description: { type: "string", example: "Discuss Q3 SIP onboarding" },
            clientId: { type: "string", example: "CLT-00042" },
            category: { type: "string", example: "Follow-up" },
            priority: { type: "string", enum: ["low", "medium", "high"], example: "high" },
            status: { type: "string", enum: ["pending", "in_progress", "done"], example: "pending" },
            dueDate: { type: "string", format: "date-time", example: "2026-10-20T10:00:00.000Z" },
            dueDateLabel: { type: "string", example: "Upcoming" },
            createdAt: { type: "string", format: "date-time", example: "2026-10-14T09:20:00.000Z" },
            userId: { type: "string", example: "0192b3c4-d5e6-7f89-a0b1-c2d3e4f5a6b7" },
          },
        },
        TaskCreateRequest: {
          type: "object",
          required: ["title", "description", "clientId", "category", "priority", "dueDate", "status"],
          properties: {
            title: { type: "string", example: "Follow up with HDFC AMC" },
            description: { type: "string", example: "Discuss Q3 SIP onboarding" },
            clientId: { type: "string", example: "CLT-00042" },
            category: { type: "string", example: "Follow-up" },
            priority: { type: "string", enum: ["low", "medium", "high"], example: "high" },
            status: { type: "string", enum: ["pending", "in_progress", "done"], example: "pending" },
            dueDate: { type: "string", format: "date-time", example: "2026-10-20T10:00:00.000Z" },
          },
        },
        TaskUpdateRequest: {
          allOf: [
            { type: "object", required: ["id"], properties: { id: { type: "string", example: "0192b3c4-d5e6-7f89-a0b1-c2d3e4f5a6b8" } } },
            { $ref: "#/components/schemas/TaskCreateRequest" },
          ],
        },
        TaskSingleResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Successfully fetched task" },
            task: { $ref: "#/components/schemas/Task" },
          },
        },
        TaskListResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Successfully fetched your tasks" },
            tasks: { type: "array", items: { $ref: "#/components/schemas/Task" } },
          },
        },

        // ---------- Lead ----------
        Lead: {
          type: "object",
          properties: {
            id: { type: "string", example: "0192b3c4-d5e6-7f89-a0b1-c2d3e4f5a6c1" },
            name: { type: "string", example: "Priya Sharma" },
            email: { type: "string", format: "email", example: "priya.sharma@example.com" },
            mobile: { type: "string", example: "+919876543210" },
            interested: { type: "string", example: "Mutual Funds" },
            lead_value: { type: "string", example: "500000" },
            pan: { type: "string", example: "ABCDE1234F" },
            status: { type: "string", example: "new" },
            source: { type: "string", example: "Website" },
            nature: { type: "string", example: "Warm" },
            follow_up_date: { type: "string", format: "date-time", example: "2026-10-25T10:00:00.000Z" },
            follow_up_label: { type: "string", example: "Upcoming" },
            reminder: { type: "boolean", example: true },
            description: { type: "string", example: "Interested in balanced advantage fund" },
            documents: { type: "array", items: { type: "string" }, example: ["pan-card.pdf", "aadhaar.pdf"] },
            clientId: { type: "string", nullable: true, example: null },
            userId: { type: "string", example: "0192b3c4-d5e6-7f89-a0b1-c2d3e4f5a6b7" },
          },
        },
        LeadCreateRequest: {
          type: "object",
          required: ["name", "email", "mobile", "pan", "interested", "lead_value", "status", "source", "nature", "follow_up_date", "reminder", "description"],
          properties: {
            name: { type: "string", example: "Priya Sharma" },
            email: { type: "string", format: "email", example: "priya.sharma@example.com" },
            mobile: { type: "string", example: "+919876543210" },
            pan: { type: "string", example: "ABCDE1234F" },
            interested: { type: "string", example: "Mutual Funds" },
            lead_value: { type: "string", example: "500000" },
            status: { type: "string", example: "new" },
            source: { type: "string", example: "Website" },
            nature: { type: "string", example: "Warm" },
            follow_up_date: { type: "string", format: "date-time", example: "2026-10-25T10:00:00.000Z" },
            reminder: { type: "boolean", example: true },
            description: { type: "string", example: "Interested in balanced advantage fund" },
            clientId: { type: "string", nullable: true, example: null },
            files: {
              type: "array",
              items: { type: "string", format: "binary" },
              description: "Supporting documents (multipart/form-data). Field name: **files**.",
            },
          },
        },
        LeadUpdateRequest: {
          allOf: [
            { type: "object", required: ["id"], properties: { id: { type: "string", example: "0192b3c4-d5e6-7f89-a0b1-c2d3e4f5a6c1" } } },
            { $ref: "#/components/schemas/LeadCreateRequest" },
          ],
        },
        LeadSingleResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Successfully fetched lead" },
            lead: { $ref: "#/components/schemas/Lead" },
          },
        },
        LeadListResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Successfully fetched your leads" },
            leads: { type: "array", items: { $ref: "#/components/schemas/Lead" } },
          },
        },

        // ---------- Analytics ----------
        AumPeriod: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "0192b3c4-d5e6-7f89-a0b1-c2d3e4f5a6d1" },
            financialYear: { type: "string", example: "2025-26" },
            quarter: { type: "integer", example: 2 },
            periodStart: { type: "string", format: "date", example: "2025-07-01" },
            periodEnd: { type: "string", format: "date", example: "2025-09-30" },
          },
        },
        AmcPerformanceRow: {
          type: "object",
          properties: {
            amc: { type: "string", example: "HDFCMutualFund_MF" },
            amcCode: { type: "string", nullable: true, example: "HDFCMutualFund_MF" },
            aum: { type: "number", example: 366045.486 },
            aaum: { type: "number", example: 405314.494 },
          },
        },
        AmcPerformanceResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Successfully fetched AMC performance analytics" },
            period: { $ref: "#/components/schemas/AumPeriod" },
            data: { type: "array", items: { $ref: "#/components/schemas/AmcPerformanceRow" } },
          },
        },
        CategoryPerformanceRow: {
          type: "object",
          properties: {
            catagory: { type: "string", description: "Legacy spelling kept for backward compatibility.", example: "Large Cap Fund" },
            category: { type: "string", example: "Large Cap Fund" },
            categoryCode: { type: "string", nullable: true, example: "LC" },
            categoryId: { type: "string", example: "0192b3c4-0000-0000-0000-000000000001" },
            aum: { type: "number", example: 366045.486 },
            aaum: { type: "number", example: 405314.494 },
          },
        },
        CategoryPerformanceResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Successfully fetched category performance analytics" },
            period: { $ref: "#/components/schemas/AumPeriod" },
            data: { type: "array", items: { $ref: "#/components/schemas/CategoryPerformanceRow" } },
          },
        },

        // ---------- Company AUM ----------
        CompanyAumImportResult: {
          type: "object",
          properties: {
            message: { type: "string", example: "Company AUM imported successfully" },
            period: { $ref: "#/components/schemas/AumPeriod" },
            matchedSchemeCount: { type: "integer", example: 128 },
            unmatchedSchemeCount: { type: "integer", example: 6 },
            totalClosingAssets: { type: "number", example: 84512003.45 },
            importIds: { type: "array", items: { type: "string" }, example: ["0192b3c4-...-a1"] },
          },
        },
      },
    },
    security: [{ sessionCookie: [] }],
  },
  apis: ["./routes/*.js"], // or point to this file if consolidated
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

router.use(
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

router.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

export { router as clientsDocsRouter, swaggerSpec };