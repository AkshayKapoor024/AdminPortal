// Company AUM routes: import company WBR22 holdings files, matched
// against the BSE master scheme list, into the company_aum table.
const express = require("express");

const router = express.Router();

const multer = require("multer");

const wrapAsync = require("../utils/wrapAsync");
const { isAuthenticated } = require("../middlewares/middleware");
const { importCompanyAum } = require("../controllers/companyAum");

// WBR22 uploads are only needed transiently for parsing (unlike lead/task
// document uploads, which are meant to be kept), so they're read straight
// into memory and never written to disk.
const upload = multer({ storage: multer.memoryStorage() });

router.post("/import", isAuthenticated, upload.array("files"), wrapAsync(importCompanyAum));

module.exports = router;
