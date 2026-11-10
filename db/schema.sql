-- Issue Tracker Database Schema

-- ********************************************************************************
-- USERS
--
-- • Never store the password itself, always use a hash.
-- ********************************************************************************
CREATE TABLE users (
	id				uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
	username			text NOT NULL, 
	email				text NOT NULL, 
	password_hash		text NOT NULL, 
	created_at			timestamptz NOT NULL DEFAULT now(), 
	email_verified_at	timestamptz 
);

-- For username and email: apply case-insensitive uniqueness
CREATE UNIQUE INDEX users_username_unique ON users (lower(username));
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));


-- ********************************************************************************
-- WORKSPACES
-- ********************************************************************************
CREATE TABLE workspaces (
	id			uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
	name		text NOT NULL, 
	created_at	timestamptz NOT NULL DEFAULT now()
);


-- ********************************************************************************
-- WORKSPACE_MEMBERS
--
-- • A user can belong to many workspaces; a workspace has many users.
-- • The Primary Key serves "who is in this workspace?"
-- ********************************************************************************
CREATE TABLE workspace_members (
	workspace_id	uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, 
	user_id			uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
	role			text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')), 
	created_at		timestamptz NOT NULL DEFAULT now(), 
	PRIMARY KEY (workspace_id, user_id)
);

-- Organize users with the workspaces they belong to
CREATE INDEX workspaces_of_users ON workspace_members (user_id);


-- ********************************************************************************
-- PROJECTS
--
-- • UNIQUE: prevents an item pointing at another workspace's project.
-- ********************************************************************************
CREATE TABLE projects (
	id				uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
	workspace_id	uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, 
	name			text NOT NULL, 
	created_at		timestamptz NOT NULL DEFAULT now(), 
	deleted_at		timestamptz, 
	deleted_by		uuid REFERENCES users(id) ON DELETE SET NULL, 
	UNIQUE (id, workspace_id)
);

-- Track deleted projects
CREATE INDEX projects_in_trash ON projects (workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;


-- ********************************************************************************
-- ITEMS
--
-- • Make sure due_date is in date format, timestamps can be inconsistent based on 
--   the timezone of the user.
-- • updated_at and updated_by are set after every edit made after the initial creation.
-- • CHECK: an item can't be marked deleted_with_project unless it's in the trash.
-- ********************************************************************************
CREATE TABLE items (
	id					uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
	workspace_id		uuid NOT NULL, 
	project_id			uuid NOT NULL, 
	title				text NOT NULL, 
	body				text NOT NULL DEFAULT '', 
	priority			text NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high')), 
	due_date			date, 
	assigned_to			uuid REFERENCES users(id) ON DELETE SET NULL, 
	created_at			timestamptz NOT NULL DEFAULT now(), 
	created_by			uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, 
	updated_at			timestamptz, 
	updated_by			uuid REFERENCES users(id) ON DELETE SET NULL, 
	deleted_at			timestamptz, 
	deleted_by			uuid REFERENCES users(id) ON DELETE SET NULL, 
	deleted_with_project	boolean NOT NULL DEFAULT false, 
	FOREIGN KEY (project_id, workspace_id)
		REFERENCES projects (id, workspace_id) ON DELETE CASCADE, 
	UNIQUE (id, workspace_id), 
	CHECK (NOT deleted_with_project OR deleted_at IS NOT NULL)
);

-- Organize by project
CREATE INDEX project_items ON items (project_id, workspace_id) WHERE deleted_at IS NULL;

-- Organize by user
CREATE INDEX users_items ON items (assigned_to, workspace_id) WHERE deleted_at IS NULL;

-- Trashed items
CREATE INDEX items_in_trash ON items (workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;


-- ********************************************************************************
-- COMMENTS
-- ********************************************************************************
CREATE TABLE comments (
	id			uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
	item_id		uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE, 
	author_id	uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, 
	body		text NOT NULL, 
	created_at	timestamptz NOT NULL DEFAULT now(), 
	deleted_at	timestamptz
);

-- Organize comments by item and post time
CREATE INDEX comments_in_items ON comments (item_id, created_at ASC);


-- ********************************************************************************
-- ITEM_SUBSCRIBERS
--
-- • A subscription is created when someone creates an item, is assigned to an item, 
--   or comments on an item.
-- • Notifications are sent out to every subscriber except for the actor.
-- • Subscribers can mute notifications on items.
-- ********************************************************************************
CREATE TABLE item_subscribers (
	item_id			uuid NOT NULL, 
	workspace_id	uuid NOT NULL, 
	user_id			uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
	is_muted		boolean NOT NULL DEFAULT false, 
	created_at		timestamptz NOT NULL DEFAULT now(), 
	FOREIGN KEY (item_id, workspace_id) 
		REFERENCES items (id, workspace_id) ON DELETE CASCADE, 
	PRIMARY KEY (item_id, user_id)
);

-- Organize users with their subscribed items
CREATE INDEX users_subscriptions ON item_subscribers (user_id);


-- ********************************************************************************
-- NOTIFICATIONS
--
-- • One notification row PER RECIPIENT, i.e. an update to 1 item with 4 
--   subscribers creates 4 notification rows in the table.
-- • No need to copy item details, frontend can JOIN to items and build the 
--   notification.
-- • Hard-deleting an item wipes linked notifications.
-- ********************************************************************************
CREATE TABLE notifications (
	id				uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
	item_id			uuid, 
	project_id		uuid, 
	workspace_id	uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, 
	recipient_id	uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
	actor_id		uuid REFERENCES users(id) ON DELETE SET NULL, 
	type			text NOT NULL CHECK (type IN (
						'assigned', 'unassigned', 'priority_changed', 'due_date_changed', 
						'project_changed', 'project_deleted', 'project_restored', 
						'comment_added', 'item_deleted', 'item_restored')), 
	payload			jsonb NOT NULL DEFAULT '{}', 
	created_at		timestamptz NOT NULL DEFAULT now(), 
	read_at			timestamptz, 
	deleted_at		timestamptz, 
	FOREIGN KEY (item_id, workspace_id) 
		REFERENCES items (id, workspace_id) ON DELETE CASCADE, 
	FOREIGN KEY (project_id, workspace_id) 
		REFERENCES projects (id, workspace_id) ON DELETE CASCADE, 
	CHECK (num_nonnulls(item_id, project_id) = 1)
);

-- Organize notifications by user (inboxes)
CREATE INDEX inboxes ON notifications (recipient_id, created_at DESC) WHERE deleted_at IS NULL;



-- ********************************************************************************
-- SESSIONS
-- 
-- Tracks active login sessions for users (while session is open, user doesn't need 
-- to login again).
-- • One row per active user 
-- • id is the SHA-256 hash of the cookie token, never the token itself
-- • Each session should expire 30 days after user's last activity
-- ********************************************************************************
CREATE TABLE sessions (
	id			text PRIMARY KEY, 
	user_id		uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
	create_at	timestamptz NOT NULL DEFAULT now(), 
	expires_at	timestamptz NOT NULL 
);

-- Organize sessions by user
CREATE INDEX user_sessions ON sessions (user_id);


-- ********************************************************************************
-- AUTH_TOKENS
-- 
-- One-time tokens for email verification and password reset (hashes only).
-- ********************************************************************************
CREATE TABLE auth_tokens (
	token_hash	text PRIMARY KEY, 
	user_id		uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
	purpose		text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')), 
	created_at	timestamptz NOT NULL DEFAULT now(), 
	expires_at	timestamptz NOT NULL, 
	use_at		timestamptz
);

-- Organize tokens by user and purpose
CREATE INDEX token_users ON auth_tokens (user_id, purpose);


-- ********************************************************************************
-- WORKSPACE_INVITES
-- 
-- 	Invites: one row per code or link; only the has of the code is stored
-- • Optionally add email (only user with verified email is invited to this workspace)
-- • Invite code expires after a set amount of time
-- • Creator can decide how many times the code can be used and can cancel the code
-- ********************************************************************************
CREATE TABLE workspace_invites (
	id				uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
	workspace_id	uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, 
	code_hash		text NOT NULL UNIQUE, 
	email			text, 
	created_by		timestamptz NOT NULL DEFAULT now(), 
	created_at		timestamptz NOT NULL DEFAULT now(), 
	expires_at		timestamptz NOT NULL, 
	revoked_at		timestamptz, 
	max_uses		integer NOT NULL DEFAULT 1 CHECK (max_uses > 0), 
	uses_count		integer NOT NULL DEFAULT 0, 
	CHECK (uses_count <= max_uses)
);

-- Organize invites by workspace
CREATE INDEX invites_by_workspace ON workspace_invites (workspace_id);