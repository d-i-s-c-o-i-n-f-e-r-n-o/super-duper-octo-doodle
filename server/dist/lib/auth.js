"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.requireAuth = requireAuth;
exports.requirePermission = requirePermission;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const db_1 = require("./db");
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, config_1.config.jwt.secret, {
        expiresIn: config_1.config.jwt.accessTtlSeconds,
    });
}
function verifyAccessToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
    if (typeof decoded !== "object" || !decoded)
        throw new Error("Invalid JWT payload");
    const accountId = decoded.accountId;
    const accountType = decoded.accountType;
    if (typeof accountId !== "number")
        throw new Error("Invalid JWT accountId");
    if (accountType !== "network_admin" && accountType !== "hotel_staff")
        throw new Error("Invalid JWT accountType");
    return { accountId, accountType };
}
async function loadPermissionsAndAuth(req) {
    // Runs after token verification.
    if (!req.auth)
        return;
    // Permissions are loaded from DB for the request (simple, safe, no cross-request caching).
    const accountId = req.auth.accountId;
    await (0, db_1.withClient)(async (client) => {
        var _a, _b;
        const perms = await client.query(`
        select p.code
        from position_permissions pp
        join permissions p on p.permission_id = pp.permission_id
        where pp.position_id = $1
      `, [(_b = (_a = req.auth.staff) === null || _a === void 0 ? void 0 : _a.positionId) !== null && _b !== void 0 ? _b : -1]);
        const permSet = new Set();
        for (const row of perms.rows)
            permSet.add(row.code);
        req.auth.permissions = permSet;
    });
}
async function requireAuth(req, res, next) {
    try {
        const authHeader = req.header("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const token = authHeader.slice("Bearer ".length);
        const { accountId, accountType } = verifyAccessToken(token);
        req.auth = {
            accountId,
            accountType,
            staff: undefined,
            permissions: new Set(),
        };
        // Load staff binding if needed.
        if (accountType === "hotel_staff") {
            await (0, db_1.withClient)(async (client) => {
                const r = await client.query(`
            select ua.staff_employee_id, ua.staff_building_id, e.position_id, p.name as position_name, ua.account_type
            from user_accounts ua
            join employees e on e.employee_id = ua.staff_employee_id and e.building_id = ua.staff_building_id
            join positions p on p.position_id = e.position_id
            where ua.account_id = $1 and ua.account_type = 'hotel_staff'
          `, [accountId]);
                if (r.rowCount !== 1)
                    throw new Error("Account not found");
                req.auth.staff = {
                    employeeId: r.rows[0].staff_employee_id,
                    buildingId: r.rows[0].staff_building_id,
                    positionId: r.rows[0].position_id,
                    positionName: r.rows[0].position_name,
                };
            });
        }
        // Permissions for network_admin: all. For staff: from DB.
        if (accountType === "network_admin") {
            req.auth.permissions = new Set(["*"]); // sentinel for admin
        }
        else {
            await loadPermissionsAndAuth(req);
        }
        next();
    }
    catch {
        res.status(401).json({ message: "Unauthorized" });
    }
}
function requirePermission(permission) {
    return (req, res, next) => {
        try {
            if (!req.auth)
                return res.status(401).json({ message: "Unauthorized" });
            const perms = req.auth.permissions;
            if (!perms)
                return res.status(403).json({ message: "Forbidden" });
            if (perms.has("*"))
                return next();
            if (perms.has(permission))
                return next();
            return res.status(403).json({ message: "Forbidden" });
        }
        catch {
            return res.status(403).json({ message: "Forbidden" });
        }
    };
}
function hashPassword(password) {
    const bcrypt = require("bcryptjs");
    return bcrypt.hash(password, 12);
}
async function verifyPassword(password, passwordHash) {
    const bcrypt = require("bcryptjs");
    return bcrypt.compare(password, passwordHash);
}
