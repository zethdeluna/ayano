import { useEffect, useState } from "react";
import { fetchItem, type ItemResponse, NotFoundError } from "../api/fetchItem";

const TEST_ITEM_ID = '00000000-0000-0000-0000-0000000000d1';

type State = 
	| { status: "loading" } 
	| { status: "not-found" } 
	| { status: "error" } 
	| { status: "ok", data: ItemResponse }
;

export function ItemDetail() {

	const [state, setState] = useState<State>({ status: "loading" });

	useEffect(() => {

		const controller = new AbortController();

		console.log(controller.signal);

		fetchItem(TEST_ITEM_ID, controller.signal)
			.then(data => {
				setState({ status: "ok", data })
				console.log('success');
			})
			.catch(err => {
				if ( err instanceof DOMException && err.name === "AbortError" ) {
					console.log(err.name);
					return;
				}
				setState(err instanceof NotFoundError ? { status: "not-found" } : { status: "error" });
			});

		return () => controller.abort();

	}, []);

	if ( state.status === "loading" ) return <p>Loading...</p>
	if ( state.status === "not-found" ) return <p>Item not found.</p>
	if ( state.status === "error" ) return <p>Something went wrong.</p>

	const { item, comments } = state.data;

	return (
		<>
			<article>
				<h1>{item.title}</h1>
				<div className="details">
					<p>Project: {item.project_name}</p>
					<p>Priority: {item.priority}</p>
					<p>Created by: {item.created_by_name}</p>
				</div>
				<div className="content">
					{item.item_body}
				</div>
			</article>
			<div className="comments">
				{comments.map(c => (
					<div className="comment" key={c.id}>
						<span className="author">{c.author}</span>
						<span className="posted-at">{c.created_at}</span>
						<p>{c.body}</p>
					</div>
				))}
			</div>
		</>
	);

};