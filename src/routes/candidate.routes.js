/**
 * Candidate Routes (standalone)
 * @swagger
 * tags:
 *   name: Candidates
 *   description: Candidate management
 */
const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidate.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { updateCandidateSchema } = require('../validators/candidate.validator');

/**
 * @swagger
 * /api/candidates/{candidateId}:
 *   put:
 *     summary: Update a candidate
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: candidateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Candidate updated
 */
router.put(
    '/:candidateId',
    authenticate,
    authorize('organizer', 'admin', 'super_admin'),
    validate(updateCandidateSchema),
    candidateController.updateCandidate
);

/**
 * @swagger
 * /api/candidates/{candidateId}:
 *   delete:
 *     summary: Delete a candidate
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: candidateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Candidate deleted
 */
router.delete(
    '/:candidateId',
    authenticate,
    authorize('organizer', 'admin', 'super_admin'),
    candidateController.deleteCandidate
);

module.exports = router;
