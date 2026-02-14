const connectDb = require('../config/db');
const Project = require('../models/Project');
const {
  getDefaultTaskDescription,
  getDefaultMilestoneDescription,
  taskNeedsAttachmentByDefault
} = require('../constants/projectTemplates');
const { recalcProjectStats } = require('../utils/projectStats');

const run = async () => {
  await connectDb();

  const projects = await Project.find();
  let updatedProjects = 0;
  let updatedMilestones = 0;
  let updatedTasks = 0;

  for (const project of projects) {
    let touched = false;

    for (const milestone of project.milestones || []) {
      if (!milestone.description) {
        milestone.description = getDefaultMilestoneDescription(milestone.name, milestone.stage);
        updatedMilestones += 1;
        touched = true;
      }

      for (const task of milestone.tasks || []) {
        if (!task.description) {
          task.description = getDefaultTaskDescription(task.name, milestone.stage);
          updatedTasks += 1;
          touched = true;
        }
        if (task.requiresAttachment === undefined || task.requiresAttachment === null) {
          task.requiresAttachment = taskNeedsAttachmentByDefault(task.name, milestone.stage);
          updatedTasks += 1;
          touched = true;
        }
      }
    }

    if (touched) {
      recalcProjectStats(project);
      await project.save();
      updatedProjects += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `Backfill completed. Projects updated: ${updatedProjects}, milestones updated: ${updatedMilestones}, task fields updated: ${updatedTasks}`
  );
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
