/**
 * Business Analytics Controller
 *
 * Provides real-time analytics on Company AUM data:
 *   1. getPerformanceAmc: aggregates total AUM and AAUM grouped by AMC (amcCode).
 *   2. getPerformanceCategory: aggregates total AUM and AAUM grouped by Category (categoryId/category name).
 *
 * Automatically inspects the current financial year & quarter and selects the latest
 * available quarter's records from CompanyAum table.
 */
const { prisma } = require("../init/prisma");
const { getFinancialYearAndQuarterForDate } = require("../utils/industry_aum/aumPeriodUtils");

/**
 * Resolves the AumPeriod to query for analytics:
 *   - Checks current date's financial year & quarter.
 *   - If current quarter has CompanyAum data, uses that period.
 *   - Otherwise, falls back to the most recent previous quarter that HAS CompanyAum data.
 *
 * @param {object} prismaClient 
 * @returns {Promise<object|null>}
 */
async function getLatestAvailableAumPeriod(prismaClient) {
    const now = new Date();
    const { financialYear, quarter } = getFinancialYearAndQuarterForDate(now);

    // 1. Check if period for current FY & Quarter exists and has data
    const currentPeriod = await prismaClient.aumPeriod.findUnique({
        where: {
            financialYear_quarter: {
                financialYear,
                quarter,
            },
        },
    });

    if (currentPeriod) {
        const count = await prismaClient.companyAum.count({
            where: { periodId: currentPeriod.id },
        });

        if (count > 0) {
            return currentPeriod;
        }
    }

    // 2. Fallback: Find latest previous period that actually has CompanyAum records
    const latestPeriodWithData = await prismaClient.aumPeriod.findFirst({
        where: {
            companyAums: {
                some: {},
            },
        },
        orderBy: [
            { periodEnd: "desc" },
            { createdAt: "desc" },
        ],
    });

    if (latestPeriodWithData) {
        return latestPeriodWithData;
    }

    // 3. Fallback if no records exist in CompanyAum table at all
    return currentPeriod || null;
}

/**
 * GET /analytics/performance_amc
 * Returns total AUM and AAUM grouped by AMC for the latest available quarter.
 */
module.exports.getPerformanceAmc = async (req, res) => {
    try {
        const period = await getLatestAvailableAumPeriod(prisma);

        if (!period) {
            return res.status(200).json({
                message: "Successfully fetched AMC performance analytics",
                period: null,
                data: [],
            });
        }

        const amcGrouped = await prisma.companyAum.groupBy({
            by: ["amcCode"],
            where: { periodId: period.id },
            _sum: {
                aum: true,
                aaum: true,
            },
            orderBy: {
                _sum: {
                    aum: "desc",
                },
            },
        });

        const data = amcGrouped.map((row) => ({
            amc: row.amcCode || "UNKNOWN",
            amcCode: row.amcCode || null,
            aum: row._sum.aum ? Number(row._sum.aum) : 0,
            aaum: row._sum.aaum ? Number(row._sum.aaum) : 0,
        }));

        return res.status(200).json({
            message: "Successfully fetched AMC performance analytics",
            period: {
                id: period.id,
                financialYear: period.financialYear,
                quarter: period.quarter,
                periodStart: period.periodStart,
                periodEnd: period.periodEnd,
            },
            data,
        });
    } catch (error) {
        return res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
};

/**
 * GET /analytics/performance_catagory
 * Returns total AUM and AAUM grouped by Category for the latest available quarter.
 */
module.exports.getPerformanceCategory = async (req, res) => {
    try {
        const period = await getLatestAvailableAumPeriod(prisma);

        if (!period) {
            return res.status(200).json({
                message: "Successfully fetched category performance analytics",
                period: null,
                data: [],
            });
        }

        const categoryGrouped = await prisma.companyAum.groupBy({
            by: ["categoryId"],
            where: { periodId: period.id },
            _sum: {
                aum: true,
                aaum: true,
            },
            orderBy: {
                _sum: {
                    aum: "desc",
                },
            },
        });

        const categoryIds = categoryGrouped.map((c) => c.categoryId);
        const categories = await prisma.aumCategory.findMany({
            where: { id: { in: categoryIds } },
        });
        const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));

        const data = categoryGrouped.map((row) => {
            const cat = categoryMap.get(row.categoryId);
            return {
                catagory: cat ? cat.name : "UNKNOWN",
                category: cat ? cat.name : "UNKNOWN",
                categoryCode: cat ? cat.code : null,
                categoryId: row.categoryId,
                aum: row._sum.aum ? Number(row._sum.aum) : 0,
                aaum: row._sum.aaum ? Number(row._sum.aaum) : 0,
            };
        });

        return res.status(200).json({
            message: "Successfully fetched category performance analytics",
            period: {
                id: period.id,
                financialYear: period.financialYear,
                quarter: period.quarter,
                periodStart: period.periodStart,
                periodEnd: period.periodEnd,
            },
            data,
        });
    } catch (error) {
        return res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
};
