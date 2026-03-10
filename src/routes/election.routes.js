/**
 * Election Routes
 * @swagger
 * tags:
 *   name: Elections
 *   description: Election management
 */
const express = require('express');
const router = express.Router();
const electionController = require('../controllers/election.controller');
const candidateController = require('../controllers/candidate.controller');
const voteController = require('../controllers/vote.controller');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { tokenRequestLimiter } = require('../middleware/ratelimit.middleware');
const {
    createElectionSchema,
    updateElectionSchema,
    electionQuerySchema,
} = require('../validators/election.validator');
const { createCandidateSchema, updateCandidateSchema } = require('../validators/candidate.validator');
const { requestVoteTokenSchema } = require('../validators/vote.validator');

// ==========================================
// ELECTIONS
// ==========================================

/**
 * @swagger
 * /api/elections:
 *   get:
 *     summary: Get all elections with filters and pagination
 *     tags: [Elections]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [presidential, legislative, local, referendum, amicale, university, corporate]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, scheduled, active, closed, cancelled]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: "-created_at"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Elections list
 */
router.get(
    '/',
    optionalAuth,
    validate(electionQuerySchema, 'query'),
    electionController.getElections
);

/**
 * @swagger
 * /api/elections/{electionId}:
 *   get:
 *     summary: Get election details
 *     tags: [Elections]
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Election details
 *       404:
 *         description: Election not found
 */
router.get('/:electionId', optionalAuth, electionController.getElectionById);

/**
 * @swagger
 * /api/elections:
 *   post:
 *     summary: Create a new election
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, type, startDate, endDate]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [presidential, legislative, local, referendum, amicale]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Election created
 *       403:
 *         description: Insufficient permissions
 */
router.post(
    '/',
    authenticate,
    authorize('organizer', 'admin', 'super_admin'),
    validate(createElectionSchema),
    electionController.createElection
);

/**
 * @swagger
 * /api/elections/{electionId}:
 *   put:
 *     summary: Update an election
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Election updated
 */
router.put(
    '/:electionId',
    authenticate,
    authorize('organizer', 'admin', 'super_admin'),
    validate(updateElectionSchema),
    electionController.updateElection
);

/**
 * @swagger
 * /api/elections/{electionId}:
 *   delete:
 *     summary: Delete an election
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Election deleted
 */
router.delete(
    '/:electionId',
    authenticate,
    authorize('admin', 'super_admin'),
    electionController.deleteElection
);

/**
 * @swagger
 * /api/elections/{electionId}/status:
 *   patch:
 *     summary: Change election status
 *     tags: [Elections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [scheduled, active, closed, cancelled]
 *     responses:
 *       200:
 *         description: Status changed
 */
router.patch(
    '/:electionId/status',
    authenticate,
    authorize('organizer', 'admin', 'super_admin'),
    electionController.changeStatus
);

// ==========================================
// CANDIDATES (nested under elections)
// ==========================================

/**
 * @swagger
 * /api/elections/{electionId}/candidates:
 *   get:
 *     summary: Get candidates for an election
 *     tags: [Candidates]
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Candidates list
 */
router.get('/:electionId/candidates', candidateController.getCandidates);

/**
 * @swagger
 * /api/elections/{electionId}/candidates:
 *   post:
 *     summary: Add a candidate to an election
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, biography]
 *             properties:
 *               fullName:
 *                 type: string
 *               politicalParty:
 *                 type: string
 *               slogan:
 *                 type: string
 *               biography:
 *                 type: string
 *               programSummary:
 *                 type: string
 *     responses:
 *       201:
 *         description: Candidate added
 */
router.post(
    '/:electionId/candidates',
    authenticate,
    authorize('organizer', 'admin', 'super_admin'),
    validate(createCandidateSchema),
    candidateController.createCandidate
);

// ==========================================
// VOTE TOKEN REQUEST (nested under elections)
// ==========================================

/**
 * @swagger
 * /api/elections/{electionId}/request-vote-token:
 *   post:
 *     summary: Request a unique vote token
 *     tags: [Voting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Vote token generated
 *       409:
 *         description: Already voted
 *       422:
 *         description: Election not active
 */
router.post(
    '/:electionId/request-vote-token',
    authenticate,
    tokenRequestLimiter,
    validate(requestVoteTokenSchema),
    voteController.requestVoteToken
);

/**
 * @swagger
 * /api/elections/{electionId}/results:
 *   get:
 *     summary: Get election results
 *     tags: [Elections]
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Election results
 *       403:
 *         description: Results not yet available
 */
router.get('/:electionId/results', optionalAuth, voteController.getResults);

module.exports = router;
