/**
 * Vote Routes
 * @swagger
 * tags:
 *   name: Voting
 *   description: Vote submission and verification
 */
const express = require('express');
const router = express.Router();
const voteController = require('../controllers/vote.controller');
const { validate } = require('../middleware/validation.middleware');
const { voteLimiter } = require('../middleware/ratelimit.middleware');
const { submitVoteSchema } = require('../validators/vote.validator');

/**
 * @swagger
 * /api/votes/submit:
 *   post:
 *     summary: Submit a vote
 *     tags: [Voting]
 *     parameters:
 *       - in: header
 *         name: X-Vote-Token
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique vote token obtained from /request-vote-token
 *       - in: header
 *         name: X-Device-Type
 *         schema:
 *           type: string
 *           enum: [web, ios, android]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [candidateId, confirmVote]
 *             properties:
 *               candidateId:
 *                 type: string
 *                 format: uuid
 *               confirmVote:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Vote submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     receiptCode:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     message:
 *                       type: string
 *       401:
 *         description: Invalid or expired vote token
 *       409:
 *         description: Already voted
 *       422:
 *         description: Election not active
 */
router.post(
    '/submit',
    voteLimiter,
    validate(submitVoteSchema),
    voteController.submitVote
);

/**
 * @swagger
 * /api/votes/verify/{receiptCode}:
 *   get:
 *     summary: Verify a vote was recorded
 *     tags: [Voting]
 *     parameters:
 *       - in: path
 *         name: receiptCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Receipt code provided after voting
 *     responses:
 *       200:
 *         description: Vote verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     verified:
 *                       type: boolean
 *                     electionId:
 *                       type: string
 *                     electionTitle:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     voteIncluded:
 *                       type: boolean
 *       404:
 *         description: Receipt not found
 */
router.get('/verify/:receiptCode', voteController.verifyVote);

module.exports = router;
