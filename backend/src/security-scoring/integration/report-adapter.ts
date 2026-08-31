import { getClient } from '../../db/connection';
import type { SecurityScoreResult } from '../types';

export async function attachScoreToReport(assessmentId: string, score: SecurityScoreResult): Promise<void> {
  const client = await getClient();
  const connection = await client.getConnection();

  try {
    await connection.beginTransaction();

    const scoreJson = JSON.stringify(score);
    const categoriesJson = JSON.stringify(score.categoryScores);
    const recommendationsJson = JSON.stringify(score.recommendations);

    const [existingScore] = await connection.query(
      'SELECT id FROM assessment_metadata WHERE assessment_id = ? AND `key` = ?',
      [assessmentId, 'security_score']
    ) as any[];

    if (existingScore) {
      await connection.query(
        'UPDATE assessment_metadata SET value = ? WHERE id = ?',
        [scoreJson, existingScore.id]
      );
    } else {
      await connection.query(
        'INSERT INTO assessment_metadata (id, assessment_id, `key`, value) VALUES (?, ?, ?, ?)',
        [require('uuid').v4(), assessmentId, 'security_score', scoreJson]
      );
    }

    const [existingCategories] = await connection.query(
      'SELECT id FROM assessment_metadata WHERE assessment_id = ? AND `key` = ?',
      [assessmentId, 'category_scores']
    ) as any[];

    if (existingCategories) {
      await connection.query(
        'UPDATE assessment_metadata SET value = ? WHERE id = ?',
        [categoriesJson, existingCategories.id]
      );
    } else {
      await connection.query(
        'INSERT INTO assessment_metadata (id, assessment_id, `key`, value) VALUES (?, ?, ?, ?)',
        [require('uuid').v4(), assessmentId, 'category_scores', categoriesJson]
      );
    }

    const [existingRecs] = await connection.query(
      'SELECT id FROM assessment_metadata WHERE assessment_id = ? AND `key` = ?',
      [assessmentId, 'recommendations']
    ) as any[];

    if (existingRecs) {
      await connection.query(
        'UPDATE assessment_metadata SET value = ? WHERE id = ?',
        [recommendationsJson, existingRecs.id]
      );
    } else {
      await connection.query(
        'INSERT INTO assessment_metadata (id, assessment_id, `key`, value) VALUES (?, ?, ?, ?)',
        [require('uuid').v4(), assessmentId, 'recommendations', recommendationsJson]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
