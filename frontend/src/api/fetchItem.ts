export class NotFoundError extends Error {};

export interface Item {
	item_id: string;
	title: string;
	item_body: string;
	priority: string;
	due_date?: Date;
	created_at: string;
	updated_at?: string;
	deleted_at?: string;
	project_id: string;
	project_name: string;
	created_by_name: string;
	assignee_name?: string;
	updated_by_name?: string;
	deleted_by_name?: string;
}

export interface Comment {
	id: string;
	body: string;
	created_at: string;
	author: string;
}

export interface ItemResponse {
	item: Item;
	comments: Comment[];
}

export async function fetchItem( id: string, signal?: AbortSignal ): Promise<ItemResponse> {

	const res = await fetch(`/api/items/${id}`, { signal });
	if ( !res.ok ) throw new Error(`Request failed with status ${res.status}`);

	return res.json();

};