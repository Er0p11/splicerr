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
