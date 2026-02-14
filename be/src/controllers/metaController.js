const Category = require('../models/Category');
const Scheme = require('../models/Scheme');
const Lead = require('../models/Lead');
const Project = require('../models/Project');
const AuditLog = require('../models/AuditLog');

const getCatalog = async (_req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    const schemes = await Scheme.find({ isActive: true })
      .populate('category', 'name')
      .sort({ name: 1 })
      .lean();

    res.json({ categories, schemes });
  } catch (err) {
    next(err);
  }
};

const getReportSummary = async (_req, res, next) => {
  try {
    const [totalLeads, convertedLeads, firstResponseRows, projects, audit7Days] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ isConverted: true }),
      Lead.find({ firstResponseMinutes: { $ne: null } }).select('firstResponseMinutes communicationStats').lean(),
      Project.find().select('currentStage activityStats').lean(),
      AuditLog.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    ]);

    const avgFirstResponseMinutes = firstResponseRows.length
      ? Math.round(
          firstResponseRows.reduce((sum, row) => sum + Number(row.firstResponseMinutes || 0), 0) /
            firstResponseRows.length
        )
      : null;

    const avgInteractionsPerLead = firstResponseRows.length
      ? Number(
          (
            firstResponseRows.reduce(
              (sum, row) =>
                sum +
                Number(row.communicationStats?.notesCount || 0) +
                Number(row.communicationStats?.callsCount || 0),
              0
            ) / firstResponseRows.length
          ).toFixed(2)
        )
      : 0;

    const stageMap = {};
    let totalTasks = 0;
    let completedTasks = 0;
    projects.forEach((project) => {
      stageMap[project.currentStage] = (stageMap[project.currentStage] || 0) + 1;
      totalTasks += Number(project.activityStats?.taskCount || 0);
      completedTasks += Number(project.activityStats?.completedTaskCount || 0);
    });

    res.json({
      totalLeads,
      convertedLeads,
      conversionRate: totalLeads ? Number(((convertedLeads / totalLeads) * 100).toFixed(2)) : 0,
      avgFirstResponseMinutes,
      avgInteractionsPerLead,
      totalProjects: projects.length,
      stageDistribution: stageMap,
      taskCompletionRate: totalTasks ? Number(((completedTasks / totalTasks) * 100).toFixed(2)) : 0,
      auditEventsLast7Days: audit7Days
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCatalog, getReportSummary };
