import { querySplice, SamplesSearch } from "$lib/splice/api"
import { refreshSampleUrl } from "./collections.svelte"
import { descrambleSample } from "$lib/splice/descrambler"
import type {
    AssetCategorySlug,
    AssetSortType,
    ChordType,
    Key,
    SampleAsset,
    SamplesSearchResponse,
    SortOrder,
    TagSummaryEntry,
} from "$lib/splice/types"
import { globalAudio } from "./audio.svelte"
import { beginSampleLoad, loading, trackSampleDownload } from "./loading.svelte"
import { fetch as tauriFetch } from "@tauri-apps/plugin-http"
import { semitonesFor } from "./transpose.svelte"
import { decodeAudioFromURL } from "./wav"
import { renderAudioBufferToWav } from "$lib/shared/audio-render-worker-client"
import { config } from "./config.svelte"
import { dispatchSampleDownloads, enqueueSampleDownload } from "./sample-download-queue"

export const DEFAULT_SORT = "relevance"
export const PER_PAGE = 50
const MAX_DESCRAMBLED_BLOBS = 4
const MAX_TRANSPOSED_BLOBS = 2

export const randomSeed = () =>
    Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString()

export const dataStore = $state({
    sampleAssets: [] as SampleAsset[],
    descrambledSamples: new Map<string, string>(),
    // Pitch-shifted preview blobs, keyed by `${uuid}:${semitones}`
    transposedSamples: new Map<string, string>(),
    tags: [] as string[],
    tag_summary: [] as TagSummaryEntry[],
    total_records: 0,
})

export const keys = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
] as const
export const chord_types = ["major", "minor"]

export const queryStore = $state({
    query: "",
    pack_uuid: null as string | null,
    sort: DEFAULT_SORT as AssetSortType,
    random_seed: randomSeed(),
    order: "DESC" as SortOrder,
    page: 1,
    asset_category_slug: null as AssetCategorySlug | null,
    bpm: null as string | null,
    min_bpm: null as number | null,
    max_bpm: null as number | null,
    key: null as Key | null,
    chord_type: null as ChordType | null,
})

// The query identity is the part of the query that uniquely identifies the returned data
// It is used to determine if the fetched data should replace the current data, be appended to it, or be ignored
const queryIdentity = $derived({
    parent_asset_uuid: queryStore.pack_uuid,
    query: queryStore.pack_uuid ? null : queryStore.query,
    sort: queryStore.sort,
    order: queryStore.order,
    random_seed: queryStore.random_seed,
    tags: queryStore.pack_uuid ? [] : dataStore.tags,
    asset_category_slug: queryStore.pack_uuid ? null : queryStore.asset_category_slug,
    bpm: queryStore.pack_uuid ? null : queryStore.bpm?.toString(),
    min_bpm: queryStore.pack_uuid ? null : queryStore.min_bpm,
    max_bpm: queryStore.pack_uuid ? null : queryStore.max_bpm,
    key: queryStore.pack_uuid ? null : queryStore.key,
    chord_type: queryStore.pack_uuid ? null : queryStore.chord_type,
})

export const storeCallbacks = $state({
    onbeforedataupdate: null as (() => void) | null,
    onbeforetagsupdate: null as (() => void) | null,
})

let currentQueryIdentity = ""
let latestFetch = 0
let retryMore = false
let lastPage = 0
let preloadWindow = new Map<string, SampleAsset>()
let attemptedPreloads = new Set<string>()
let activePreloads = 0
const sourceDownloads = new Map<string, { promise: Promise<string>; prioritize: () => void }>()

async function fetchBinaryResponse(url: string, signal?: AbortSignal) {
    try {
        return await window.fetch(url, { signal })
    } catch (err) {
        if (signal?.aborted) throw err
        console.info("🌐 Browser fetch failed, falling back to Tauri HTTP", err)
        return await tauriFetch(url, { signal })
    }
}

function touchMapEntry<T>(map: Map<string, T>, key: string) {
    const value = map.get(key)
    if (value === undefined) return value

    map.delete(key)
    map.set(key, value)
    return value
}

function trimDescrambledCache() {
    const recentLimit = Math.max(MAX_DESCRAMBLED_BLOBS, config.parallel_sample_downloads)
    let recent = 0
    for (const uuid of [...dataStore.descrambledSamples.keys()].reverse()) {
        if (uuid === globalAudio.currentAsset?.uuid || preloadWindow.has(uuid)) continue
        if (++recent <= recentLimit) continue

        const blobURL = dataStore.descrambledSamples.get(uuid)!
        dataStore.descrambledSamples.delete(uuid)
        window.URL.revokeObjectURL(blobURL)
    }
}

function trimTransposedCache() {
    for (const [key, blobURL] of dataStore.transposedSamples) {
        if (dataStore.transposedSamples.size <= MAX_TRANSPOSED_BLOBS) break
        if (key.startsWith(`${globalAudio.currentAsset?.uuid}:`)) continue

        dataStore.transposedSamples.delete(key)
        window.URL.revokeObjectURL(blobURL)
        console.info("🧹 Trimmed transposed sample blob")
    }
}

function requestAssets(more: boolean) {
    const identity = JSON.stringify(queryIdentity)
    if (
        more &&
        (loading.assets || identity !== currentQueryIdentity ||
            queryStore.page >= lastPage)
    ) return

    const page = more ? queryStore.page + 1 : 1
    const request = ++latestFetch
    if (!more) storeCallbacks.onbeforedataupdate?.()
    loading.assets = true

    const isLatest = () => request === latestFetch && identity === JSON.stringify(queryIdentity)
    querySplice(SamplesSearch, {
        ...queryIdentity,
        page,
        limit: PER_PAGE,
    })
        .then((response) => {
            if (!isLatest()) return
            const { items, pagination_metadata, response_metadata, tag_summary } =
                (response as SamplesSearchResponse).data.assetsSearch

            const seen = new Set(more ? dataStore.sampleAssets.map((sample) => sample.uuid) : [])
            const samples = items.filter((sample) => {
                if (seen.has(sample.uuid)) return false
                seen.add(sample.uuid)
                return true
            })
            if (more) dataStore.sampleAssets.push(...samples)
            else dataStore.sampleAssets = samples

            currentQueryIdentity = identity
            queryStore.page = page
            lastPage = pagination_metadata.totalPages
            dataStore.total_records = response_metadata.records
            storeCallbacks.onbeforetagsupdate?.()
            dataStore.tag_summary = tag_summary
            loading.beforeFirstLoad = false
            loading.fetchError = null
        })
        .catch((error: Error) => {
            if (!isLatest()) return
            console.error("Failed to fetch assets", error)
            retryMore = more
            loading.fetchError = error
        })
        .finally(() => {
            if (request === latestFetch) loading.assets = false
        })
}

export const fetchAssets = () => requestAssets(false)
export const fetchMoreAssets = () => requestAssets(true)
export const retryAssets = () => requestAssets(retryMore && currentQueryIdentity === JSON.stringify(queryIdentity))

export function setPackScope(packUuid: string | null) {
    if (queryStore.pack_uuid === packUuid) return
    queryStore.pack_uuid = packUuid
    dataStore.sampleAssets = []
    dataStore.total_records = 0
    dataStore.tag_summary = []
    loading.fetchError = null
    fetchAssets()
}

export function setSamplePreloadWindow(samples: SampleAsset[], limit = config.parallel_sample_downloads) {
    preloadWindow = new Map(samples.map((sample) => [sample.uuid, sample]))
    attemptedPreloads = new Set([...attemptedPreloads].filter((uuid) => preloadWindow.has(uuid)))
    trimDescrambledCache()
    dispatchSampleDownloads()
    fillPreloadSlots(limit)
}

function fillPreloadSlots(limit = config.parallel_sample_downloads) {
    for (const sample of preloadWindow.values()) {
        if (activePreloads >= limit) break
        if (dataStore.descrambledSamples.has(sample.uuid) || attemptedPreloads.has(sample.uuid)) continue

        attemptedPreloads.add(sample.uuid)
        activePreloads++
        void getDescrambledSampleURL(sample, true)
            .catch((error) => console.debug("Preview preload failed", sample.uuid, error))
            .finally(() => {
                activePreloads--
                fillPreloadSlots()
            })
    }
}

export function prioritizeSampleDownload(uuid: string) {
    sourceDownloads.get(uuid)?.prioritize()
}

export function getDescrambledSampleURL(sampleAsset: SampleAsset, background = false): Promise<string> {
    const uuid = sampleAsset.uuid
    const cached = touchMapEntry(dataStore.descrambledSamples, uuid)
    if (cached) return Promise.resolve(cached)
    const pending = sourceDownloads.get(uuid)
    if (pending) {
        if (!background) pending.prioritize()
        return pending.promise
    }

    const transfer = enqueueSampleDownload(() => downloadSampleBytes(sampleAsset), background)
    const download = transfer.promise.then((bytes) => {
        const url = window.URL.createObjectURL(new Blob([bytes], { type: "audio/mp3" }))
        dataStore.descrambledSamples.set(uuid, url)
        trimDescrambledCache()
        return url
    }).finally(() => sourceDownloads.delete(uuid))
    sourceDownloads.set(uuid, { promise: download, prioritize: transfer.prioritize })
    return download
}

export async function getDescrambledSampleBytes(sampleAsset: SampleAsset, signal?: AbortSignal) {
    const finishLoad = beginSampleLoad(sampleAsset.uuid)
    try {
        const cached = touchMapEntry(dataStore.descrambledSamples, sampleAsset.uuid)
        if (cached) {
            const response = await window.fetch(cached, { signal })
            return new Uint8Array(await response.arrayBuffer())
        }
        return await enqueueSampleDownload(() => downloadSampleBytes(sampleAsset, signal), false, signal).promise
    } finally {
        finishLoad()
    }
}

async function downloadSampleBytes(sampleAsset: SampleAsset, signal?: AbortSignal) {
    const transfer = trackSampleDownload(sampleAsset.uuid)
    try {
        signal?.throwIfAborted()
        let response = await fetchBinaryResponse(sampleAsset.files[0].url, signal)
        // Collection URLs can expire between visits. Refresh and retry once.
        if (!response.ok && await refreshSampleUrl(sampleAsset)) {
            signal?.throwIfAborted()
            response = await fetchBinaryResponse(sampleAsset.files[0].url, signal)
        }
        if (!response.ok) {
            throw new Error(`Sample fetch failed (${response.status} ${response.statusText})`)
        }

        const data = await readPreviewResponse(response, transfer.update)
        signal?.throwIfAborted()
        return descrambleSample(data)
    } finally {
        transfer.finish()
    }
}

async function readPreviewResponse(response: Response, update: (progress: number) => void) {
    const size = Number(response.headers.get("content-length"))
    if (!response.body || !Number.isSafeInteger(size) || size <= 0) {
        return new Uint8Array(await response.arrayBuffer())
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    let percent = 0
    update(0)
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            received += value.byteLength
            const next = Math.min(100, Math.floor(received / size * 100))
            if (next > percent) {
                percent = next
                update(percent / 100)
            }
        }
    } finally {
        reader.releaseLock()
    }
    const data = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
        data.set(chunk, offset)
        offset += chunk.byteLength
    }
    return data
}

/**
 * Returns a blob URL of the sample pitch-shifted by `semitones`,
 * rendering and caching it on first use.
 */
export async function getTransposedSampleURL(
    sampleAsset: SampleAsset,
    semitones: number
) {
    const cacheKey = `${sampleAsset.uuid}:${semitones}`
    const existing = touchMapEntry(dataStore.transposedSamples, cacheKey)
    if (existing) {
        console.info("✔️ Reusing transposed sample blob")
        return existing
    }

    const finishLoad = beginSampleLoad(sampleAsset.uuid)

    try {
        const descrambledURL = await getDescrambledSampleURL(sampleAsset)
        const buffer = await decodeAudioFromURL(descrambledURL)
        const { wavData } = await renderAudioBufferToWav(buffer, {
            semitones,
            tempoRatio: 1,
            trimStartSeconds: 0,
            maxDurationSeconds: null,
        })
        const blobURL = window.URL.createObjectURL(
            new Blob([wavData], { type: "audio/wav" })
        )
        const previous = dataStore.transposedSamples.get(cacheKey)
        if (previous) {
            window.URL.revokeObjectURL(blobURL)
            return previous
        }
        dataStore.transposedSamples.set(cacheKey, blobURL)
        trimTransposedCache()
        console.info(`🎚️ Created transposed sample blob (${semitones} st)`)
        return blobURL
    } finally {
        finishLoad()
    }
}

/** Picks the right playback URL for a sample given the current transpose settings. */
export async function getPlaybackSampleURL(sampleAsset: SampleAsset) {
    const semitones = semitonesFor(sampleAsset)
    if (!semitones) return await getDescrambledSampleURL(sampleAsset)
    return await getTransposedSampleURL(sampleAsset, semitones)
}

/** Drops every cached pitch-shifted blob (e.g. after transpose settings change). */
export function clearTransposedCache() {
    for (const url of dataStore.transposedSamples.values()) {
        window.URL.revokeObjectURL(url)
    }
    dataStore.transposedSamples.clear()
    console.info("🧹 Cleared transposed sample cache")
}
