"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_1 = __importDefault(require("./admin"));
const auth_1 = __importDefault(require("./auth"));
const dashboard_1 = __importDefault(require("./dashboard"));
const donations_1 = __importDefault(require("./donations"));
const requests_1 = __importDefault(require("./requests"));
const router = (0, express_1.Router)();
router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
router.use("/auth", auth_1.default);
router.use("/requests", requests_1.default);
router.use("/donations", donations_1.default);
router.use("/admin", admin_1.default);
router.use("/dashboard", dashboard_1.default);
exports.default = router;
