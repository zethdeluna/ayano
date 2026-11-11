import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";

export const itemsRouter = Router();

// TEMPORARY until the membership middleware (stage 6)
const WORKSPACE_ID = "00000000-0000-0000-0000-0000000000b1";

// z.uuid() requires a valid version digit and variant
// temporarily using z.guid(), whicih accepts any 8-4-4-4-12 hex shape to validate my seed ids
const itemIdSchema = z.guid();

itemsRouter.get("/:id", async(req, res) => {

	const parsed = itemIdSchema.safeParse(req.params.id);
	if ( !parsed.success ) {
		res.status(400).json({ error: "Invalid item id" });
		return;
	}

	const id = parsed.data;

	try {

		// Get item details
		const itemResult = await pool.query(
			`
			SELECT 
				i.id				AS item_id, 
				i.title, 
				i.body				AS item_body, 
				i.priority, 
				i.due_date, 
				i.created_at, 
				i.updated_at, 
				i.deleted_at, 
				p.id				AS project_id, 
				p.name				AS project_name, 
				creator.username	AS created_by_name, 
				assignee.username	AS assignee_name, 
				updater.username	AS updated_by_name, 
				deleter.username	AS deleted_by_name 
			FROM items i 
			JOIN projects p
				ON p.id = i.project_id 
				AND p.workspace_id = i.workspace_id 
			JOIN users creator ON creator.id = i.created_by 
			LEFT JOIN users assignee ON assignee.id = i.assigned_to 
			LEFT JOIN users updater ON updater.id = i.updated_by 
			LEFT JOIN users deleter ON deleter.id = i.deleted_by 
			WHERE i.id = $1 AND i.workspace_id = $2
			;
			`,
			[id, WORKSPACE_ID]
		);

		const item = itemResult.rows[0];

		if ( !item ) {
			res.status(400).json({ error: "Not found" });
			return;
		}

		// Get item's comments
		const commentsResult = await pool.query(
			`
			SELECT 
				c.id, 
				c.body, 
				c.created_at, 
				u.username AS author 
			FROM comments c 
			JOIN users u ON u.id = c.author_id
			JOIN items i ON i.id = c.item_id 
			WHERE c.item_id = $1 
				AND i.workspace_id = $2 
				AND c.deleted_at IS NULL
			ORDER BY c.created_at ASC
			;
			`,
			[id, WORKSPACE_ID]
		);

		res.json({ item, comments: commentsResult.rows });

	} catch (err) {

		console.error(err);
		res.status(500).json({ error: "Internal server error" });

	}

});