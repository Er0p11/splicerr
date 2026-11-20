import type { SampleAsset } from "$lib/splice/types"

export function manualTempoRatio(asset: SampleAsset | null, bpm: number | null) {
    const sourceBpm = asset?.bpm
    if (!bpm || !sourceBpm || sourceBpm <= 0) return null

    const ratio = bpm / sourceBpm
    // Keep native preview playback within the WebView's supported rate range.
    return ratio >= 0.25 && ratio <= 4 ? ratio : null
}
