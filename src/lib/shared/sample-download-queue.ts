import { config } from "./config.svelte"

type Transfer = () => Promise<void>
const foreground: Transfer[] = []
const background: Transfer[] = []
let activeDownloads = 0

export function dispatchSampleDownloads() {
    while (activeDownloads < config.parallel_sample_downloads) {
        const next = foreground.shift() ?? background.shift()
        if (!next) break
        activeDownloads++
        void next().finally(() => {
            activeDownloads--
            dispatchSampleDownloads()
        })
    }
}

export function enqueueSampleDownload<T>(
    download: () => Promise<T>,
    isBackground: boolean,
    signal?: AbortSignal
) {
    let prioritize = () => {}
    const promise = new Promise<T>((resolve, reject) => {
        signal?.throwIfAborted()
        let queue = isBackground ? background : foreground
        const run = async () => {
            signal?.removeEventListener("abort", cancel)
            try {
                resolve(await download())
            } catch (error) {
                reject(error)
            }
        }
        const cancel = () => {
            const index = queue.indexOf(run)
            if (index !== -1) queue.splice(index, 1)
            reject(signal?.reason)
        }
        prioritize = () => {
            if (queue !== background) return
            const index = background.indexOf(run)
            if (index === -1) return
            background.splice(index, 1)
            queue = foreground
            queue.push(run)
            dispatchSampleDownloads()
        }
        queue.push(run)
        signal?.addEventListener("abort", cancel, { once: true })
        dispatchSampleDownloads()
    })
    return { promise, prioritize }
}
