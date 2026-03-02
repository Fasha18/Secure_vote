const { Worker } = require('bullmq');
const { query } = require('../config/database');
const { cache } = require('../config/redis');
const { connection } = require('../config/queue');
const logger = require('../utils/logger');

/**
 * Vote Worker
 * Processes votes from the 'vote-queue' and performs heavy DB aggregations.
 * This offloads the main thread and prevents DB lock contention during voting spikes.
 */
const voteWorker = new Worker('vote-queue', async (job) => {
    const { electionId, candidateId } = job.data;

    try {
        // 1. Increment candidate vote count (atomic)
        await query(
            `UPDATE candidates SET vote_count = vote_count + 1 WHERE id = $1`,
            [candidateId]
        );

        // 2. Increment election vote count & update participation rate
        await query(
            `UPDATE elections
             SET total_votes_cast = total_votes_cast + 1,
                 participation_rate = CASE
                   WHEN total_registered_voters > 0
                   THEN ((total_votes_cast + 1) * 100.0 / total_registered_voters)
                   ELSE 0
                 END
             WHERE id = $1`,
            [electionId]
        );

        // 3. Update candidate percentages for this election
        await query(
            `UPDATE candidates c
             SET vote_percentage = CASE
               WHEN e.total_votes_cast > 0
               THEN (c.vote_count * 100.0 / e.total_votes_cast)
               ELSE 0
             END
             FROM elections e
             WHERE c.election_id = e.id AND c.election_id = $1`,
            [electionId]
        );

        // 4. Invalidate results cache
        await cache.del(`election:${electionId}:results`);

        logger.info(`Vote aggregate updated for election ${electionId}`);

    } catch (error) {
        logger.error('Worker failed to process vote aggregate', {
            jobId: job.id,
            error: error.message,
            electionId,
        });
        throw error; // Let BullMQ handle retry
    }
}, { connection, concurrency: 5 });

voteWorker.on('completed', (job) => {
    logger.debug(`Vote job ${job.id} completed`);
});

voteWorker.on('failed', (job, err) => {
    logger.error(`Vote job ${job.id} failed`, { error: err.message });
});

module.exports = voteWorker;
