import { BROWSER, DEV } from 'esm-env';
import { ActionFailure, HttpError, Redirect } from '../runtime/control.js';
import { get_route_segments } from '../utils/routing.js';

export { VERSION } from '../version.js';

/**
 * @overload
 * @param {number} status
 * @param {App.Error} body
 * @return {HttpError}
 */

/**
 * @overload
 * @param {number} status
 * @param {{ message: string } extends App.Error ? App.Error | string | undefined : never} [body]
 * @return {HttpError}
 */

/**
 * Creates an `HttpError` object with an HTTP status code and an optional message.
 * This object, if thrown during request handling, will cause SvelteKit to
 * return an error response without invoking `handleError`.
 * Make sure you're not catching the thrown error, which would prevent SvelteKit from handling it.
 * @param {number} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses). Must be in the range 400-599.
 * @param {{ message: string } extends App.Error ? App.Error | string | undefined : never} body An object that conforms to the App.Error type. If a string is passed, it will be used as the message property.
 */
export function error(status, body) {
	if ((!BROWSER || DEV) && (isNaN(status) || status < 400 || status > 599)) {
		throw new Error(`HTTP error status codes must be between 400 and 599 — ${status} is invalid`);
	}

	return new HttpError(status, body);
}

/**
 * Crée un objet `Redirect`. Si levé pendant le traitement d'une requête, Sveltekit va retourner une réponse de redirection.
 * Assurez-vous de ne pas "attraper" la redirection levée, ce qui empêcherait SvelteKit de la gérer.
 * @param {300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#redirection_messages). Must be in the range 300-308.
 * @param {string | URL} location The location to redirect to.
 */
export function redirect(status, location) {
	if ((!BROWSER || DEV) && (isNaN(status) || status < 300 || status > 308)) {
		throw new Error('Invalid status code');
	}

	return new Redirect(status, location.toString());
}

/**
 * Crée un objet `Response` en <span class='vo'>[JSON](https://sveltefr.dev/docs/web#json)</span> à partir des données fournies.
 * @param {any} data The value that will be serialized as JSON.
 * @param {ResponseInit} [init] Options such as `status` and `headers` that will be added to the response. `Content-Type: application/json` and `Content-Length` headers will be added automatically.
 */
export function json(data, init) {
	// TODO deprecate this in favour of `Response.json` when it's
	// more widely supported
	const body = JSON.stringify(data);

	// we can't just do `text(JSON.stringify(data), init)` because
	// it will set a default `content-type` header. duplicated code
	// means less duplicated work
	const headers = new Headers(init?.headers);
	if (!headers.has('content-length')) {
		headers.set('content-length', encoder.encode(body).byteLength.toString());
	}

	if (!headers.has('content-type')) {
		headers.set('content-type', 'application/json');
	}

	return new Response(body, {
		...init,
		headers
	});
}

const encoder = new TextEncoder();

/**
 * Crée un objet `Response` à partir du <span class='vo'>[body](https://sveltefr.dev/docs/web#body)</span> fournit.
 * @param {string} body The value that will be used as-is.
 * @param {ResponseInit} [init] Options such as `status` and `headers` that will be added to the response. A `Content-Length` header will be added automatically.
 */
export function text(body, init) {
	const headers = new Headers(init?.headers);
	if (!headers.has('content-length')) {
		const encoded = encoder.encode(body);
		headers.set('content-length', encoded.byteLength.toString());
		return new Response(encoded, {
			...init,
			headers
		});
	}

	return new Response(body, {
		...init,
		headers
	});
}

/**
 * Crée un objet `ActionFailure`.
 * @template {Record<string, unknown> | undefined} [T=undefined]
 * @param {number} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses). Must be in the range 400-599.
 * @param {T} [data] Data associated with the failure (e.g. validation errors)
 * @returns {ActionFailure<T>}
 */
export function fail(status, data) {
	return new ActionFailure(status, data);
}

const basic_param_pattern = /\[(\[)?(\.\.\.)?(\w+?)(?:=(\w+))?\]\]?/g;

/**
 * Remplit un identifiant de route avec les paramètres pour construire un chemin.
 * @example
 * ```js
 * resolvePath(
 *   `/blog/[slug]/[...somethingElse]`,
 *   {
 *     slug: 'hello-world',
 *     somethingElse: 'something/else'
 *   }
 * ); // `/blog/hello-world/something/else`
 * ```
 * @param {string} id
 * @param {Record<string, string | undefined>} params
 * @returns {string}
 */
export function resolvePath(id, params) {
	const segments = get_route_segments(id);
	return (
		'/' +
		segments
			.map((segment) =>
				segment.replace(basic_param_pattern, (_, optional, rest, name) => {
					const param_value = params[name];

					// This is nested so TS correctly narrows the type
					if (!param_value) {
						if (optional) return '';
						if (rest && param_value !== undefined) return '';
						throw new Error(`Missing parameter '${name}' in route ${id}`);
					}

					if (param_value.startsWith('/') || param_value.endsWith('/'))
						throw new Error(
							`Parameter '${name}' in route ${id} cannot start or end with a slash -- this would cause an invalid route like foo//bar`
						);
					return param_value;
				})
			)
			.filter(Boolean)
			.join('/')
	);
}
