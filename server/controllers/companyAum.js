/**
 * Company AUM controller.
 *
 * Handles the company-side AUM import feature: accepts one or more
 * WBR22 files plus an ISO date string identifying the reporting
 * quarter, and hands them to `companyAumIngestionService` for parsing,
 * fund-to-category matching, and persistence.
 */
const { ingestCompanyAumFiles } = require("../services/companyAumIngestionService");
const CustomError = require("../utils/customError");

module.exports.importCompanyAum = async (req, res) => {
    const files = req.files;
    const { quarterDate } = req.body;

    if (!files || files.length === 0) {
        throw new CustomError(400, 'At least one WBR22 file is required (field name "files")');
    }

    if (!quarterDate) {
        throw new CustomError(400, "quarterDate (an ISO date string) is required to identify the reporting quarter");
    }

    const result = await ingestCompanyAumFiles({ files, quarterDateIso: quarterDate });

    res.status(200).json(result);
};
