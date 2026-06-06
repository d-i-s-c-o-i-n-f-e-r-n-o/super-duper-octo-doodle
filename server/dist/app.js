"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const pino_http_1 = __importDefault(require("pino-http"));
const config_1 = require("./config");
const auth_1 = require("./routes/auth");
const admin_1 = require("./routes/admin");
const clients_1 = require("./routes/clients");
const bookings_1 = require("./routes/bookings");
const meta_1 = require("./routes/meta");
function createApp() {
    const app = (0, express_1.default)();
    app.disable("x-powered-by");
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({
        origin: config_1.config.cors.origin,
        credentials: false,
    }));
    app.use((0, pino_http_1.default)());
    app.use((0, morgan_1.default)("tiny"));
    app.use(express_1.default.json({ limit: "1mb" }));
    app.get("/api/health", (_req, res) => {
        res.json({ ok: true });
    });
    app.use("/api/auth", auth_1.authRouter);
    app.use("/api/admin", admin_1.adminRouter);
    app.use("/api/clients", clients_1.clientRouter);
    app.use("/api/meta", meta_1.metaRouter);
    app.use("/api/bookings", bookings_1.bookingRouter);
    app.get('/', (req, res) => {
        res.send('OK');
    });
    return app;
}
