import { startDrag } from "@crabnebula/tauri-plugin-drag"
import { join, appCacheDir } from "@tauri-apps/api/path"
import { exists, create, mkdir, readFile } from "@tauri-apps/plugin-fs"
import { saveDawStretchedSample, savePackImage, saveSample, saveTempoAlignedSample } from "./files.svelte"
import { semitonesFor, transposeSuffix } from "./transpose.svelte"
import { beginSampleLoad } from "./loading.svelte"
import { config, isSamplesDirValid, settingsDialog } from "./config.svelte"
import { SvelteMap } from "svelte/reactivity"
import { manualTempoRatio } from "./tempo"
import { toast } from "./toasts.svelte"
import type { SampleAsset, PackAsset } from "$lib/splice/types"

async function createDragIcon(
    packImagePath: string,
    packId: string
): Promise<string> {
    const cacheDir = await appCacheDir()
    const iconPath = await join(cacheDir, `${packId}.png`)

    if (!(await exists(iconPath))) {
        // Ensure cache directory exists
        if (!(await exists(cacheDir))) {
            await mkdir(cacheDir)
        }

        // Read the saved pack image file
        const imageData = await readFile(packImagePath)
        const buffer = new ArrayBuffer(imageData.byteLength)
        const view = new Uint8Array(buffer)
        view.set(imageData)
        const resizedImageData = await resizeImageToCorner(buffer)
        const file = await create(iconPath)
        await file.write(resizedImageData)
        await file.close()
    }

    return iconPath
}

async function createInvisibleIcon(): Promise<string> {
    const cacheDir = await appCacheDir()
    const iconPath = await join(cacheDir, "invisible-drag-icon.png")

    if (!(await exists(iconPath))) {
        if (!(await exists(cacheDir))) {
            await mkdir(cacheDir)
        }

        const transparentPng = new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
            0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
            0x0b, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x02, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
            0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
        ])

        const file = await create(iconPath)
        await file.write(transparentPng)
        await file.close()
    }

    return iconPath
}

async function resizeImageToCorner(
    imageBuffer: ArrayBuffer
): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([imageBuffer])
        const img = new Image()
        const url = URL.createObjectURL(blob)
        const iconSize = 64
        img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error("Could not decode pack artwork"))
        }
        img.onload = () => {
            URL.revokeObjectURL(url)
            const canvasWidth = iconSize * 2
            const canvasHeight = iconSize * 2.5
            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")!

            canvas.width = canvasWidth
            canvas.height = canvasHeight

            // Transparent background
            ctx.clearRect(0, 0, canvasWidth, canvasHeight)

            // Position the image in the top-right corner of the canvas
            const x = canvasWidth - iconSize
            const y = 0

            ctx.drawImage(img, x, y, iconSize, iconSize)

            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error("Could not encode drag icon"))
                    return
                }
                blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject)
            }, "image/png")
        }
        img.src = url
    })
}

type DragData = { path: string; iconPath: string }

// Cache the on-disk WAV + drag icon per sample (keyed by uuid + transpose, since
// the saved path depends on the transpose suffix), so that the actual drag can be
// started synchronously.
const dragCache = new SvelteMap<string, DragData>()
const inFlight = new Map<string, Promise<DragData | null>>()

export type DragTempo = { source: "bridge" | "manual"; bpm: number }

export function sampleDragKey(sample: SampleAsset, tempo?: DragTempo) {
    const variant = tempo ? `${tempo.source}:${tempo.bpm}` : "original"
    const semitones = semitonesFor(sample)
    return `${config.samples_dir}:${sample.uuid}:${semitones}:${transposeSuffix(semitones)}:${variant}`
}

export function manualDragTempo(sample: SampleAsset | null): DragTempo | undefined {
    const bpm = config.manual_bpm
    if (bpm && manualTempoRatio(sample, bpm) !== null) return { source: "manual", bpm }
}

export function isSampleDragReady(sample: SampleAsset, tempo?: DragTempo) {
    return dragCache.has(sampleDragKey(sample, tempo))
}

async function dragIconForSample(sampleAsset: SampleAsset) {
    try {
        const pack = sampleAsset.parents.items[0] as PackAsset
        const packImagePath = await savePackImage(sampleAsset)
        if (packImagePath && (await exists(packImagePath))) {
            return await createDragIcon(packImagePath, pack.uuid)
        }
    } catch (error) {
        console.debug("Could not use pack artwork for the drag icon", error)
    }
    return await createInvisibleIcon()
}

/**
 * Prepares a sample for dragging: descrambles + writes the WAV and builds the
 * drag icon, caching the result. Idempotent and deduplicated, and cheap once the
 * files already exist on disk. Call this ahead of the drag gesture (on hover /
 * pointerdown) so `handleSampleDrag` has everything ready synchronously.
 */
export function prefetchSampleDrag(sampleAsset: SampleAsset, tempo?: DragTempo, background = false) {
    const key = sampleDragKey(sampleAsset, tempo)
    const cached = dragCache.get(key)
    if (cached) return Promise.resolve(cached)
    const existing = inFlight.get(key)
    if (existing) return existing

    const pending = (async () => {
        const finishLoad = background ? null : beginSampleLoad(sampleAsset.uuid)
        try {
            const path = tempo?.source === "bridge"
                ? await saveDawStretchedSample(sampleAsset, tempo.bpm)
                : tempo
                  ? await saveTempoAlignedSample(sampleAsset, tempo.bpm)
                  : await saveSample(sampleAsset)
            const iconPath = await dragIconForSample(sampleAsset)
            const data = { path, iconPath }
            dragCache.set(key, data)
            return data
        } catch (error) {
            console.error("Failed preparing WAV for drag", error)
            return null
        } finally {
            finishLoad?.()
            inFlight.delete(key)
        }
    })()
    inFlight.set(key, pending)
    return pending
}

/** The macOS native drag must start while the current drag event is still active. */
export function handleSampleDrag(event: DragEvent, sampleAsset: SampleAsset, tempo?: DragTempo) {
    event.preventDefault()
    if (!isSamplesDirValid()) {
        settingsDialog.open = true
        return
    }
    const data = dragCache.get(sampleDragKey(sampleAsset, tempo))
    if (data) {
        void startDrag({ item: [data.path], icon: data.iconPath }).catch((error) =>
            console.error("Could not start sample drag", error)
        )
    } else {
        const pending = inFlight.has(sampleDragKey(sampleAsset, tempo))
        if (pending) {
            toast({ title: "WAV is preparing", description: "Drag again when it is ready.", duration: 2500 })
        } else {
            void prefetchSampleDrag(sampleAsset, tempo).then((ready) => {
                if (ready) toast({ title: "WAV ready to drag", duration: 2500 })
            })
        }
    }
}

// Drop queued rows on scroll or settings changes. Let the single in-flight
// render finish so it can be reused when the sample returns to the viewport.
let alignedQueue: { sample: SampleAsset; tempo: DragTempo; key: string }[] = []
let renderingAligned = false

export function setAlignedDragWindow(samples: SampleAsset[]) {
    alignedQueue = samples.flatMap((sample) => {
        const tempo = manualDragTempo(sample)
        return tempo ? [{ sample, tempo, key: sampleDragKey(sample, tempo) }] : []
    })
    queueMicrotask(() => void prepareNextAlignedSample())
}

async function prepareNextAlignedSample() {
    if (renderingAligned) return
    renderingAligned = true
    try {
        while (alignedQueue.length) {
            const { sample, tempo, key } = alignedQueue.shift()!
            if (sampleDragKey(sample, manualDragTempo(sample)) !== key) continue
            if (!isSampleDragReady(sample, tempo)) await prefetchSampleDrag(sample, tempo, true)
        }
    } finally {
        renderingAligned = false
    }
}
