-- Filter Alice's inbox with unread notifications, sorted by newest first, and showing the 
-- associated item or project.
SELECT 
	n.id, 
	n.type, 
	n.payload, 
	n.created_at, 
	u.username	AS actor_name, 
	i.id		AS item_id, 
	i.title		AS item_title, 
	p.id		AS project_id, 
	p.name		AS project_name
FROM notifications n 
LEFT JOIN items		i ON i.id = n.item_id 
LEFT JOIN projects	p ON p.id = n.project_id 
LEFT JOIN users		u ON u.id = n.actor_id 
WHERE n.recipient_id = '00000000-0000-0000-0000-0000000000a2'	-- Alice
	AND n.workspace_id = '00000000-0000-0000-0000-0000000000b1' 
	AND n.deleted_at IS NULL 
	AND n.read_at IS NULL
ORDER BY n.created_at DESC 
LIMIT 50;




-- Filter the Projects page with active items for one workspace, grouped by project
SELECT 
	p.id		AS project_id, 
	p.name		AS project_name, 
	i.id		AS item_id, 
	i.title		AS item_title, 
	i.priority, 
	i.due_date, 
	i.assigned_to 
FROM projects p 
LEFT JOIN items i 
	ON i.project_id = p.id 					-- matching project id
	AND i.workspace_id = p.workspace_id 	-- matching workspace id
	AND i.deleted_at IS NULL				-- item is active
WHERE p.workspace_id = '00000000-0000-0000-0000-0000000000b1' 
	AND p.deleted_at IS NULL 				-- project is active
ORDER BY p.name, i.created_at DESC;





-- Item detail page: one item plus its comment thread

-- Get item details
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
	assignee.username	AS assignee_name 
FROM items i 
JOIN projects p 
	ON p.id = i.project_id 
	AND p.workspace_id = i.workspace_id 
JOIN users creator 
	ON creator.id = i.created_by 
LEFT JOIN users assignee 
	ON assignee.id = i.assigned_to 
WHERE i.id = '00000000-0000-0000-0000-0000000000d1' 
	AND i.workspace_id = '00000000-0000-0000-0000-0000000000b1';

-- Get item's comments
SELECT 
	c.id			AS comment_id, 
	c.body, 
	c.created_at, 
	u.username		AS author 
FROM comments c
JOIN items i ON i.id = c.item_id 
JOIN users u ON u.id = c.author_id 
WHERE c.item_id = '00000000-0000-0000-0000-0000000000d1' 
	AND i.workspace_id = '00000000-0000-0000-0000-0000000000b1' 
	AND c.deleted_at IS NULL 
ORDER BY c.created_at ASC;


BEGIN

	-- Get item details
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
	WHERE i.id = '00000000-0000-0000-0000-0000000000d1' 
		AND i.workspace_id = '00000000-0000-0000-0000-0000000000b1' 
	;

	-- Get item's comments
	SELECT 
		c.id, 
		c.body, 
		c.created_at, 
		u.username		AS author 
	FROM comments c
	JOIN users u ON u.id = c.author_id 
	JOIN items i ON i.id = c.item_id 
	WHERE c.item_id = '00000000-0000-0000-0000-0000000000d1' 
		AND i.workspace_id = '00000000-0000-0000-0000-0000000000b1' 
		AND c.deleted_at IS NULL 
	ORDER BY c.created_at ASC;

END;



-- Trash page

-- Get trashed projects
SELECT 
	p.id, 
	p.name, 
	p.created_at, 
	p.deleted_at, 
	u.username		AS deleted_by_name 
FROM projects p 
LEFT JOIN users u ON u.id = p.deleted_by 
WHERE p.workspace_id = '00000000-0000-0000-0000-0000000000b1' 
	AND p.deleted_at IS NOT NULL
ORDER BY p.deleted_at DESC
LIMIT 10;

-- Get trashed items
SELECT 
	i.id, 
	i.title, 
	i.deleted_at, 
	i.deleted_with_project, 
	u.username					AS deleted_by_name, 
	p.name						AS project_name, 
	p.deleted_at				AS project_deleted_at 
FROM items i
LEFT JOIN users u ON u.id = i.deleted_by 
JOIN projects p ON p.id = i.project_id AND p.workspace_id = i.workspace_id 
WHERE i.workspace_id = '00000000-0000-0000-0000-0000000000b1' 
	AND i.deleted_at IS NOT NULL
ORDER BY i.deleted_at DESC
LIMIT 50;




-- Trashing an item
-- $1: actor id
-- $2: item id
-- $3: workspace id
BEGIN 
	-- Notify subscribers of this item (before it's trashed) 
	INSERT INTO notifications (workspace_id, recipient_id, actor_id, item_id, type) 
	SELECT i.workspace_id, s.user_id, $1::uuid, i.id, 'item_deleted' 
	FROM items i 
	JOIN item_subscribers s ON s.item_id = i.id 
	WHERE i.id = $2 
		AND i.workspace_id = $3 
		AND i.deleted_at IS NULL 
		AND s.user_id <> $1 
		AND NOT s.is_muted 
	;

	-- Trash the item
	UPDATE items 
	SET deleted_at = now(), 
		deleted_by = $1
	WHERE id = $2
		AND workspace_id = $3 
		AND deleted_at IS NULL
	;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'item not found, wrong workspace, or already trashed';
	END IF;

END;



-- Trashing a project (id: '00000000-0000-0000-0000-0000000000c1') and its active items
DO $$

DECLARE
	v_actor		uuid := '00000000-0000-0000-0000-0000000000a1';
	v_project	uuid := '00000000-0000-0000-0000-0000000000c1';
	v_ws		uuid := '00000000-0000-0000-0000-0000000000b1';

BEGIN 
	-- Notify subscribers of the project's active items (before they're trashed)
	INSERT INTO notifications (workspace_id, recipient_id, actor_id, project_id, type) 
	SELECT p.workspace_id, s.user_id, v_actor, v_project, 'project_deleted' 
	FROM projects p 
	JOIN items i 
		ON i.project_id = p.id 
		AND i.workspace_id = p.workspace_id 
		AND i.deleted_at IS NULL 
	JOIN item_subscribers ON s.item_id = i.id
	WHERE p.id = v_project
		AND p.workspace_id = v_ws 
		AND p.deleted_at IS NULL 
		AND s.user_id <> v_actor 
		AND NOT s.is_muted 
	GROUP BY p.workspace_id, s.user_id, p.id;

	-- Trash the project (muse succeed with UPDATE 1, otherwise ROLLBACK) 
	UPDATE projects 
	SET deleted_at = now(), deleted_by = v_actor 
	WHERE id = v_project
		AND workspace_id = v_ws 
		AND deleted_at IS NULL
	;

	IF NOT FOUND THEN 
		RAISE EXCEPTION 'project not found, wrong workspcae, or already trashed';
	END IF;

	-- Trash its active items 
	UPDATE items 
	SET deleted_at = now(),
		deleted_by = v_actor, 
		deleted_with_project = true 
	WHERE project_id = v_project 
		AND workspace_id = v_ws 
		AND deleted_at IS NULL
	;
	
END $$;


-- The same, but with variable placeholders
-- $1: actor id
-- $2: project id
-- $3: workspace id
BEGIN

	-- Notify subscribers of the project's active items (before they're trashed)
	INSERT INTO notifications (workspace_id, recipient_id, actor_id, project_id, type) 
	SELECT p.workspace_id, s.user_id, $1::uuid, p.id, 'project_deleted' 
	FROM projects p 
	JOIN items i 
		ON i.project_id = p.id 
		AND i.workspace_id = p.workspace_id 
		AND i.deleted_at IS NULL 
	JOIN item_subscribers s ON s.item_id = i.id 
	WHERE p.id = $2 
		AND p.workspace_id = $3 
		AND p.deleted_at IS NULL 
		AND s.user_id <> $1 
		AND NOT s.is_muted
	GROUP BY p.workspace_id, s.user_id, p.id;

	-- Trash the project
	UPDATE projects 
	SET deleted_at = now(), 
		deleted_by = $1 
	WHERE id = $2 
		AND workspace_id = $3 
		AND deleted_at IS NULL
	;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'project not found, wrong workspace, or already trashed';
	END IF;

	-- Trash its active items
	UPDATE items 
	SET deleted_at = now(),
		deleted_by = $1, 
		deleted_with_project = true 
	WHERE project_id = $2 
		AND workspace_id = $3 
		AND deleted_at IS NULL
	;

END;