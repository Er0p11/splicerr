import type { SampleAsset } from "$lib/splice/types"
import { config } from "$lib/shared/config.svelte"
import { getPlaybackSampleURL } from "$lib/shared/store.svelte"

let playbackRequest = 0
let loadedAssetUuid: string | null = null
let prevVolume = 0.8

export const globalAudio = $state({
    ref: null! as HTMLAudioElement,
    currentAsset: null as SampleAsset | null, // TODO: selected asset & audio player asset need to be thought through again
    paused: true,
    currentTime: 0,
    duration: 0,
    loading: false,
    volume: 0.8,
    progress() {
        return this.currentTime / this.duration
    },
    togglePlay() {
        if (!this.currentAsset) return
        if (this.loading && loadedAssetUuid !== this.currentAsset.uuid) {
            playbackRequest++
            this.loading = false
            return
        }
        if (loadedAssetUuid !== this.currentAsset.uuid) {
            void this.playSampleAsset(this.currentAsset)
            return
        }
        this.paused = !this.paused
    },
    toggleMute() {
        if (this.volume > 0) {
            prevVolume = this.volume
            this.volume = 0
        } else {
            this.volume = prevVolume
        }
    },
    selectSampleAsset(sampleAsset: SampleAsset) {
        if (this.currentAsset?.uuid === sampleAsset.uuid) return

        playbackRequest++
        loadedAssetUuid = null
        this.ref.pause()
        this.ref.removeAttribute("src")
        this.ref.load()
        this.paused = true
        this.currentTime = 0
        this.duration = 0
        this.loading = false
        this.currentAsset = sampleAsset
    },
    async playSampleAsset(sampleAsset: SampleAsset, from = 0, play = true) {
        this.selectSampleAsset(sampleAsset)
        const request = ++playbackRequest
        this.loading = true
        try {
            const src = await getPlaybackSampleURL(sampleAsset)
            if (request !== playbackRequest) return

            if (this.ref.src !== src) this.ref.src = src
            loadedAssetUuid = sampleAsset.uuid
            this.ref.currentTime = from
            this.ref.loop = sampleAsset.asset_category_slug === "loop" && config.repeat_audio
            if (play) await this.ref.play()
            else this.ref.pause()
        } catch (error) {
            if (request !== playbackRequest || (error instanceof DOMException && error.name === "AbortError")) return
            console.error("Failed to play sample", error)
        } finally {
            if (request === playbackRequest) this.loading = false
        }
    },
    async reloadCurrent() {
        const asset = this.currentAsset
        if (!asset || (loadedAssetUuid !== asset.uuid && !this.loading)) return
        const pendingStart = loadedAssetUuid !== asset.uuid && this.loading
        await this.playSampleAsset(asset, this.ref.currentTime || 0, pendingStart || !this.paused)
    },
})
