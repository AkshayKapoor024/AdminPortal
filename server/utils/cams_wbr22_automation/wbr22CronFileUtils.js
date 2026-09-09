/**
 * WBR22 cron-file helpers.
 *
 * Converts an extracted CAMS CSV path into the in-memory file shape accepted
 * by the established Company AUM importer, and resolves the period from the
 * report's CAMS `To Date` without relying on server-local timezone settings.
 */
const fs = require("fs/promises");
const path = require("path");
const CustomError = require("../customError");

function camsDateToIsoDate(value) {
    const match = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;

    const [, dayText, monthText, yearText] = match;
    const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
    if (date.getUTCFullYear() !== Number(yearText) || date.getUTCMonth() !== Number(monthText) - 1 || date.getUTCDate() !== Number(dayText)) {
        return null;
    }

    return date.toISOString().slice(0, 10);
}

async function buildWbr22CronFile(extractedReport) {
    const csvPath = extractedReport?.paths?.csvPath;
    const quarterDateIso = camsDateToIsoDate(extractedReport?.identifiers?.reportToDate);

    if (!csvPath || !quarterDateIso) {
        throw new CustomError(422, "Extracted WBR22 report is missing its CSV path or a valid CAMS To Date");
    }

    return {
        quarterDateIso,
        file: {
            originalname: path.basename(csvPath),
            buffer: await fs.readFile(csvPath),
        },
    };
}

module.exports = { camsDateToIsoDate, buildWbr22CronFile };
