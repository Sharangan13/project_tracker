export async function logActivity(client, auth, { teamId, action, entityType, entityId = null, targetUserId = null, message, details = {} }) {
  await client.query(
    `insert into activity_logs (team_id, actor_id, actor_name, action, entity_type, entity_id, target_user_id, message, details)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [teamId, auth.user.id, auth.user.displayName, action, entityType, entityId, targetUserId, message, JSON.stringify(details)],
  );
}
