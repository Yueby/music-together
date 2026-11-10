/** The response surface consumed by search and lyric hooks; no global fetch replacement. */
export type MetadataResponse = Pick<Response, 'ok' | 'status' | 'json' | 'text'>
export type MetadataRequestInit = Pick<RequestInit, 'signal' | 'credentials' | 'method'>
export type MetadataFetch = (input: string, init?: MetadataRequestInit) => Promise<MetadataResponse>
