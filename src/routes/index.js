/**
 * Routes Index
 * Central route registration
 */
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const electionRoutes = require('./election.routes');
const voteRoutes = require('./vote.routes');
const candidateRoutes = require('./candidate.routes');
const userRoutes = require('./user.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/elections', electionRoutes);
router.use('/votes', voteRoutes);
router.use('/candidates', candidateRoutes);
router.use('/users', userRoutes);

module.exports = router;
