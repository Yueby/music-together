declare module '@meting/core' {
  class Meting {
    constructor(site: string)
    format(enable: boolean): this
    site(site: string): this
    search(keyword: string, options?: { limit?: number; page?: number }): Promise<string>
    song(id: string): Promise<string>
    album(id: string): Promise<string>
    artist(id: string): Promise<string>
    playlist(id: string): Promise<string>
    url(id: string, bitrate?: number): Promise<string>
    lyric(id: string): Promise<string>
    pic(id: string, size?: number): Promise<string>
  }
  export default Meting
}
