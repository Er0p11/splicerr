import type { SampleAsset } from "$lib/splice/types"
import { dirname, join } from "@tauri-apps/api/path"
import { exists, create, mkdir, rename, remove } from "@tauri-apps/plugin-fs"
import {
    getDescrambledSampleBytes,
    getDescrambledSampleURL,
} from "./store.svelte"
import { config, isSamplesDirValid } from "$lib/shared/config.svelte"
import {
    semitonesFor,
    transposeSuffix,
} from "$lib/shared/transpose.svelte"
import {
    decodeAudioFromArrayBuffer,
    decodeAudioFromURL,
} from "$lib/shared/wav"
import { renderAudioBufferToWav } from "$lib/shared/audio-render-worker-client"
import { manualTempoRatio } from "$lib/shared/tempo"

export type DawStretchedSample = {
    path: string
    durationSeconds: number
}

type EncodeOptions = {
    shouldCancel?: () => boolean
    releaseSourceAfterRender?: boolean
    signal?: AbortSignal
    backgroundDownload?: boolean
}

export function safePathPart(part: string) {
    const name = part.replace(/[^a-zA-Z0-9#_.-]/g, "_").replace(/\.+$/, "") || "_"
    return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `_${name}` : name
}

const sanitizePath = (path: string) => path.split("/").filter(Boolean).map(safePathPart).join("/")

// Insert a suffix (e.g. transpose tag) right before the file extension.
const withSuffix = (name: string, suffix: string, forceWav: boolean) => {
    if (!suffix && !forceWav) return name
    const dot = name.lastIndexOf(".")
    const hasExtension = dot > name.lastIndexOf("/")
    const stem = hasExtension ? name.slice(0, dot) : name
    const extension = forceWav ? ".wav" : hasExtension ? name.slice(dot) : ""
    return stem + suffix + extension
}

const sampleAssetPath = (sampleAsset: SampleAsset, suffix: string, forceWav: boolean) =>
    sanitizePath(
        `${sampleAsset.parents.items[0].name}/${withSuffix(sampleAsset.name, suffix, forceWav)}`
    )

async function ensureFileDirectoryExists(filePath: string) {
    await mkdir(await dirname(filePath), { recursive: true })
}

function nextFrame() {
    return new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve())
    })
}

async function writeFileChunked(filePath: string, data: Uint8Array) {
    await ensureFileDirectoryExists(filePath)

    const temporaryPath = `${filePath}.${crypto.randomUUID()}.part`
    const file = await create(temporaryPath)
    const chunkSize = 1024 * 1024

    try {
        try {
            for (let offset = 0; offset < data.byteLength;) {
                const written = await file.write(data.subarray(offset, offset + chunkSize))
                if (!written) throw new Error("Could not write WAV data")
                offset += written
                if (offset < data.byteLength) await nextFrame()
            }
        } finally {
            await file.close()
        }
        if (!(await exists(filePath))) await rename(temporaryPath, filePath)
    } finally {
        if (await exists(temporaryPath)) await remove(temporaryPath)
    }
}

export async function absoluteSamplePath(sampleAsset: SampleAsset, suffix = "", forceWav = false) {
    if (!config.samples_dir) {
        throw new Error("❌ Samples Directory not set")
    }

    if (!isSamplesDirValid()) {
        throw new Error("❌ Samples Directory invalid")
    }

    return await join(config.samples_dir, sampleAssetPath(sampleAsset, suffix, forceWav))
}

function estimatedRenderedDurationSeconds(
    sampleAsset: SampleAsset,
    tempoRatio: number
) {
    const metadataSeconds = sampleAsset.duration / 1000
    if (!Number.isFinite(metadataSeconds) || metadataSeconds <= 0) return 0
    if (!Number.isFinite(tempoRatio) || tempoRatio <= 0) return metadataSeconds
    return metadataSeconds / tempoRatio
}

async function encodeSampleWavWithDuration(
    sampleAsset: SampleAsset,
    semitones = semitonesFor(sampleAsset),
    tempoRatio = 1,
    trimToMetadataDuration = true,
    options: EncodeOptions = {}
): Promise<{ wavData: Uint8Array; durationSeconds: number }> {
    const throwIfCancelled = () => {
        if (options.shouldCancel?.() || options.signal?.aborted) {
            throw new DOMException("Sample render cancelled", "AbortError")
        }
    }

    throwIfCancelled()
    const decoded = options.releaseSourceAfterRender
        ? await (async () => {
              const bytes = await getDescrambledSampleBytes(
                  sampleAsset,
                  options.signal
              )
              const arrayBuffer = bytes.buffer.slice(
                  bytes.byteOffset,
                  bytes.byteOffset + bytes.byteLength
              )
              return await decodeAudioFromArrayBuffer(arrayBuffer, {
                  isolatedContext: true,
                  signal: options.signal,
              })
          })()
        : await decodeAudioFromURL(await getDescrambledSampleURL(sampleAsset, options.backgroundDownload), {
              signal: options.signal,
          })

    throwIfCancelled()
    const metadataDuration = (sampleAsset.duration / 1000) / tempoRatio
    const rendered = await renderAudioBufferToWav(decoded, {
        semitones,
        tempoRatio,
        trimStartSeconds: config.cut_mp3_delay ? 0.012 : 0,
        maxDurationSeconds: trimToMetadataDuration ? metadataDuration : null,
        signal: options.signal,
    })
    throwIfCancelled()

    console.info(
        "🎚️ Encoded sample duration",
        {
            name: sampleAsset.name,
            metadataSeconds: sampleAsset.duration / 1000,
            decodedSeconds: decoded.duration,
            renderedSeconds: rendered.durationSeconds,
            trimToMetadataDuration,
        }
    )

    return {
        wavData: rendered.wavData,
        durationSeconds: rendered.durationSeconds,
    }
}

/**
 * Descrambles a sample and returns its decoded, trimmed WAV bytes (16-bit),
 * pitch-shifted by `semitones` (defaults to the current transpose setting).
 * Pure: does no disk I/O, so it's reused for both saving and zip export.
 */
export async function encodeSampleWav(
    sampleAsset: SampleAsset,
    semitones = semitonesFor(sampleAsset),
    tempoRatio = 1,
    trimToMetadataDuration = true,
    options: EncodeOptions = {}
): Promise<Uint8Array> {
    return (
        await encodeSampleWavWithDuration(
            sampleAsset,
            semitones,
            tempoRatio,
            trimToMetadataDuration,
            options
        )
    ).wavData
}

export async function saveSample(sampleAsset: SampleAsset) {
    const semitones = semitonesFor(sampleAsset)
    const absolutePath = await absoluteSamplePath(
        sampleAsset,
        transposeSuffix(semitones),
        true
    )

    if (!absolutePath) {
        throw new Error("❌ Invalid path")
    }

    if (await exists(absolutePath)) {
        console.log("🗃️ Sample already exists at", absolutePath)
        return absolutePath
    }

    const wavData = await encodeSampleWav(sampleAsset, semitones)

    console.log("🏆 Sample converted! Saving at", absolutePath)

    await writeFileChunked(absolutePath, wavData)

    console.log("🎉 Success!")

    return absolutePath
}

export async function saveDawStretchedSampleInfo(
    sampleAsset: SampleAsset,
    dawBpm: number,
    options: EncodeOptions = {}
): Promise<DawStretchedSample> {
    const semitones = semitonesFor(sampleAsset)
    const sourceBpm = sampleAsset.bpm
    const oneShot = sampleAsset.duration <= 3000
    const tempoRatio =
        !oneShot && sourceBpm && sourceBpm > 0 && dawBpm > 0
            ? dawBpm / sourceBpm
            : 1
    const suffix = `${transposeSuffix(semitones)}_daw_full_${Math.round(dawBpm * 100) / 100}bpm`
    const absolutePath = await absoluteSamplePath(sampleAsset, suffix, true)

    if (!absolutePath) {
        throw new Error("❌ Invalid path")
    }

    if (await exists(absolutePath)) {
        console.log("🗃️ DAW-stretched sample already exists at", absolutePath)
        if (options.shouldCancel?.()) {
            throw new DOMException("Sample render cancelled", "AbortError")
        }
        return {
            path: absolutePath,
            durationSeconds: estimatedRenderedDurationSeconds(
                sampleAsset,
                tempoRatio
            ),
        }
    }

    const { wavData, durationSeconds } = await encodeSampleWavWithDuration(
        sampleAsset,
        semitones,
        tempoRatio,
        false,
        {
            ...options,
            releaseSourceAfterRender: true,
        }
    )

    if (options.shouldCancel?.()) {
        throw new DOMException("Sample render cancelled", "AbortError")
    }

    console.log("🏆 DAW-stretched sample converted! Saving at", absolutePath)

    await writeFileChunked(absolutePath, wavData)

    console.log("🎉 DAW-stretched sample saved!")

    return { path: absolutePath, durationSeconds }
}

export async function saveDawStretchedSample(
    sampleAsset: SampleAsset,
    dawBpm: number
) {
    return (await saveDawStretchedSampleInfo(sampleAsset, dawBpm)).path
}

export async function saveTempoAlignedSample(sampleAsset: SampleAsset, bpm: number, backgroundDownload = false) {
    const tempoRatio = manualTempoRatio(sampleAsset, bpm)
    if (tempoRatio === null) throw new Error("Sample cannot be aligned to that BPM")

    const semitones = semitonesFor(sampleAsset)
    const path = await absoluteSamplePath(
        sampleAsset,
        `${transposeSuffix(semitones)}_${bpm}bpm`,
        true
    )
    if (!(await exists(path))) {
        const wav = await encodeSampleWav(sampleAsset, semitones, tempoRatio, true, { backgroundDownload })
        await writeFileChunked(path, wav)
    }
    return path
}

export function originalWavPath(sample: SampleAsset, suffix = "") {
    return sanitizePath(withSuffix(sample.name, suffix, true))
}

export async function saveOriginalWav(sample: SampleAsset, path: string) {
    if (!(await exists(path))) {
        const wav = await encodeSampleWav(sample, 0, 1, true, { backgroundDownload: true })
        await writeFileChunked(path, wav)
    }
}
