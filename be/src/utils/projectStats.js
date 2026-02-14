const recalcProjectStats = (project) => {
  const stats = {
    milestoneCount: (project.milestones || []).length,
    taskCount: 0,
    completedTaskCount: 0,
    commentCount: 0,
    attachmentCount: 0
  };

  (project.milestones || []).forEach((milestone) => {
    (milestone.tasks || []).forEach((task) => {
      stats.taskCount += 1;
      if (task.status === 'COMPLETED') stats.completedTaskCount += 1;
      stats.commentCount += (task.comments || []).length;
      stats.attachmentCount += (task.attachments || []).length;
    });
  });

  project.activityStats = stats;
  return stats;
};

module.exports = { recalcProjectStats };
