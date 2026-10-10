// Analytics routes: business analytics endpoints for AMC and Category performance.
const express = require("express");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync");
const { isAuthenticated, AnalyticsValidate } = require("../middlewares/middleware");
const { getPerformanceAmc, getPerformanceCategory } = require("../controllers/analytics");

// AMC Performance analytics
router.get("/performance_amc", isAuthenticated, AnalyticsValidate, wrapAsync(getPerformanceAmc));
router.post("/performance_amc", isAuthenticated, AnalyticsValidate, wrapAsync(getPerformanceAmc));

// Category Performance analytics (supporting both requested spelling "performance_catagory" and standard "performance_category")
router.get("/performance_catagory", isAuthenticated, AnalyticsValidate, wrapAsync(getPerformanceCategory));
router.post("/performance_catagory", isAuthenticated, AnalyticsValidate, wrapAsync(getPerformanceCategory));

router.get("/performance_category", isAuthenticated, AnalyticsValidate, wrapAsync(getPerformanceCategory));
router.post("/performance_category", isAuthenticated, AnalyticsValidate, wrapAsync(getPerformanceCategory));

module.exports = router;
