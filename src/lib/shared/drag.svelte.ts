import { startDrag } from "@crabnebula/tauri-plugin-drag"
import { SvelteMap } from "svelte/reactivity"
import dragIcon from "../../../src-tauri/icons/32x32.png?inline"
import type { SampleAsset } from "$lib/splice/types"
import { config, isSamplesDirValid, settingsDialog } from "./config.svelte"
import { saveDawStretchedSample, saveSample, saveTempoAlignedSample } from "./files.svelte"
import { beginSampleLoad } from "./loading.svelte"
import { manualTempoRatio } from "./tempo"
import { prioritizeSampleDownload } from "./store.svelte"
import { semitonesFor, transposeSuffix } from "./transpose.svelte"

const dragCache = new SvelteMap<string, string>()
const inFlight = new Map<string, Promise<string | null>>()

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

export function prefetchSampleDrag(sampleAsset: SampleAsset, tempo?: DragTempo, background = false) {
    const key = sampleDragKey(sampleAsset, tempo)
    const cached = dragCache.get(key)
    if (cached) return Promise.resolve(cached)
    const existing = inFlight.get(key)
    if (existing) {
        if (!background) prioritizeSampleDownload(sampleAsset.uuid)
        return existing
    }

    const pending = (async () => {
        const finishLoad = background ? null : beginSampleLoad(sampleAsset.uuid)
        try {
            const path = tempo?.source === "bridge"
                ? await saveDawStretchedSample(sampleAsset, tempo.bpm)
                : tempo
                  ? await saveTempoAlignedSample(sampleAsset, tempo.bpm, background)
                  : await saveSample(sampleAsset)
            dragCache.set(key, path)
            return path
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

type DragTarget = { sample: SampleAsset; tempo?: DragTempo }
type ResolveDragTarget = (event: MouseEvent) => DragTarget | null

function nativeDrag(path: string, key: string) {
    return startDrag({ item: [path], icon: dragIcon }).catch((error) => {
        if (dragCache.get(key) === path) dragCache.delete(key)
        console.error("Could not start sample drag", error)
    })
}

export function sampleDrag(node: HTMLElement, resolveTarget: ResolveDragTarget) {
    const listeners = new AbortController()
    const options = { signal: listeners.signal }
    let hoverTimer: number | undefined
    let cancelGesture: (() => void) | undefined
    let suppressClick = false

    if (navigator.userAgent.includes("Windows")) {
        // Starting an HTML drag cancels pointer tracking. Keep the same mouse
        // gesture alive until Windows can take over with the actual file path.
        node.draggable = false
        node.addEventListener("pointerdown", (event) => {
            suppressClick = false
            cancelGesture?.()
            const target = resolveTarget(event)
            if (!target || event.button !== 0 || event.pointerType !== "mouse") return

            const { pointerId, clientX, clientY } = event
            const press = new AbortController()
            const duringPress = { signal: press.signal }
            let dragged = false
            let active = true

            function cancel() {
                active = false
                press.abort()
                if (node.hasPointerCapture(pointerId)) node.releasePointerCapture(pointerId)
                cancelGesture = undefined
            }

            function end(event: PointerEvent) {
                if (event.pointerId === pointerId) cancel()
            }

            cancelGesture = cancel
            node.setPointerCapture(pointerId)
            node.addEventListener("pointerup", end, duringPress)
            node.addEventListener("pointercancel", end, duringPress)
            node.addEventListener("lostpointercapture", end, duringPress)
            window.addEventListener("blur", cancel, duringPress)
            window.addEventListener("keydown", (event) => {
                if (event.key === "Escape") cancel()
            }, duringPress)

            node.addEventListener("pointermove", async (event) => {
                if (event.pointerId !== pointerId) return
                if ((event.buttons & 1) === 0) {
                    cancel()
                    return
                }
                if (dragged || Math.hypot(event.clientX - clientX, event.clientY - clientY) < 5) return

                dragged = true
                suppressClick = true
                if (!isSamplesDirValid()) {
                    cancel()
                    settingsDialog.open = true
                    return
                }

                const key = sampleDragKey(target.sample, target.tempo)
                const path = dragCache.get(key) ?? await prefetchSampleDrag(target.sample, target.tempo)
                if (path && active) {
                    const current = resolveTarget(event)
                    if (current && sampleDragKey(current.sample, current.tempo) === key) {
                        // Give up WebView pointer capture before OLE takes over.
                        cancel()
                        void nativeDrag(path, key)
                    }
                }
            }, duringPress)
        }, options)

        node.addEventListener("click", (event) => {
            if (!suppressClick || event.detail === 0) return
            suppressClick = false
            event.preventDefault()
            event.stopImmediatePropagation()
        }, { ...options, capture: true })
    } else {
        node.draggable = true
        const warm = (event: MouseEvent) => {
            const target = resolveTarget(event)
            if (target && isSamplesDirValid()) void prefetchSampleDrag(target.sample, target.tempo)
        }
        node.addEventListener("pointerenter", (event) => {
            hoverTimer = window.setTimeout(() => warm(event), 120)
        }, options)
        node.addEventListener("pointerleave", () => window.clearTimeout(hoverTimer), options)
        node.addEventListener("pointerdown", (event) => {
            if (event.button === 0) warm(event)
        }, options)
        node.addEventListener("dragstart", (event) => {
            event.preventDefault()
            const target = resolveTarget(event)
            if (!target) return
            if (!isSamplesDirValid()) {
                settingsDialog.open = true
                return
            }
            const key = sampleDragKey(target.sample, target.tempo)
            const path = dragCache.get(key)
            // AppKit starts the native session from the current drag event.
            if (path) void nativeDrag(path, key)
            else void prefetchSampleDrag(target.sample, target.tempo)
        }, options)
    }

    return {
        update(next: ResolveDragTarget) {
            resolveTarget = next
        },
        destroy() {
            cancelGesture?.()
            window.clearTimeout(hoverTimer)
            listeners.abort()
        },
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
