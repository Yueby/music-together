const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function trimTrailingSlash(url: string): string {
	return url.replace(/\/+$/, '')
}

function resolveServerUrl(): string {
	const configuredUrl = import.meta.env.VITE_SERVER_URL?.trim()

	if (configuredUrl) {
		try {
			const parsed = new URL(configuredUrl)
			if (import.meta.env.DEV && LOCALHOST_HOSTS.has(parsed.hostname) && !LOCALHOST_HOSTS.has(window.location.hostname)) {
				parsed.hostname = window.location.hostname
			}
			return trimTrailingSlash(parsed.toString())
		} catch {
			return trimTrailingSlash(configuredUrl)
		}
	}

	if (import.meta.env.DEV) {
		return `${window.location.protocol}//${window.location.hostname}:3001`
	}

	return window.location.origin
}

export const SERVER_URL = resolveServerUrl()
