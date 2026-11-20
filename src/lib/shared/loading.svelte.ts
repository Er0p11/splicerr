import { SvelteMap } from "svelte/reactivity"

export const loading = $state({
    assets: false,
    waveformsCount: 0,
    samples: new Set<string>(),
    samplesCount: 0,
    beforeFirstLoad: true,
    fetchError: null as Error | null,
    setCursor: (wait: boolean) => {
        if (wait) {
            document.body.classList.add("waiting")
        } else {
            document.body.classList.remove("waiting")
        }
    },
})

// undefined = idle, null = transfer with no known size, number = proportion.
export const sampleDownloads = new SvelteMap<string, number | null>()
const activeDownloads = new Map<string, Map<symbol, number | null>>()

export function trackSampleDownload(uuid: string) {
    const key = Symbol()
    const transfers = activeDownloads.get(uuid) ?? new Map()
    activeDownloads.set(uuid, transfers)
    const update = (progress: number | null) => {
        transfers.set(key, progress)
        const known = [...transfers.values()].filter((value): value is number => value !== null)
        sampleDownloads.set(uuid, known.length ? Math.max(...known) : null)
    }
    update(null)

    return {
        update,
        finish() {
            transfers.delete(key)
            if (transfers.size === 0) {
                activeDownloads.delete(uuid)
                sampleDownloads.delete(uuid)
            } else {
                const known = [...transfers.values()].filter((value): value is number => value !== null)
                sampleDownloads.set(uuid, known.length ? Math.max(...known) : null)
            }
        },
    }
}

const sampleLoadCounts = new Map<string, number>()

export function beginSampleLoad(uuid: string) {
    sampleLoadCounts.set(uuid, (sampleLoadCounts.get(uuid) ?? 0) + 1)
    loading.samples.add(uuid)
    loading.samplesCount++

    return () => {
        const count = sampleLoadCounts.get(uuid)!
        if (count === 1) {
            sampleLoadCounts.delete(uuid)
            loading.samples.delete(uuid)
        } else {
            sampleLoadCounts.set(uuid, count - 1)
        }
        loading.samplesCount--
    }
}
