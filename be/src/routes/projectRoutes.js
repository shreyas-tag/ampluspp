const express = require('express');
const {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  addMilestone,
  updateMilestone,
  addTaskToMilestone,
  updateTask,
  completeTask,
  addTaskComment,
  uploadTaskAttachment,
  downloadTaskAttachment
} = require('../controllers/projectController');
const { requireAuth, adminOnly } = require('../middlewares/auth');
const { uploadPdf } = require('../middlewares/upload');

const router = express.Router();

router.use(requireAuth);
router.get('/', listProjects);
router.get('/:id', getProjectById);
router.post('/', adminOnly, createProject);
router.patch('/:id', adminOnly, updateProject);
router.post('/:id/milestones', adminOnly, addMilestone);
router.patch('/:id/milestones/:milestoneId', adminOnly, updateMilestone);
router.post('/:id/milestones/:milestoneId/tasks', adminOnly, addTaskToMilestone);
router.patch('/:id/milestones/:milestoneId/tasks/:taskId', adminOnly, updateTask);
router.get('/:id/milestones/:milestoneId/tasks/:taskId/attachments/:attachmentId/download', downloadTaskAttachment);
router.post('/:id/milestones/:milestoneId/tasks/:taskId/complete', completeTask);
router.post('/:id/milestones/:milestoneId/tasks/:taskId/comments', addTaskComment);
router.post('/:id/milestones/:milestoneId/tasks/:taskId/attachments', uploadPdf.single('file'), uploadTaskAttachment);

module.exports = router;
