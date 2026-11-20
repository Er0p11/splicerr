import { PacksSearch, SamplesSearch, querySplice } from "./api"
import type { AssetSearchResponse, PackAsset, SampleAsset } from "./types"

const PAGE_SIZE = 50

export async function fetchPacksPage(query: string, page: number) {
    const response = await querySplice(PacksSearch, { query, page, limit: PAGE_SIZE }) as
        AssetSearchResponse<PackAsset> | null
    const result = response?.data?.assetsSearch
    if (!result) throw new Error("Could not load packs")
    return result
}

export async function fetchPackSamplesPage(packUuid: string, page: number) {
    const response = await querySplice(SamplesSearch, {
        parent_asset_uuid: packUuid, sort: "name", order: "ASC", page, limit: PAGE_SIZE,
    }) as AssetSearchResponse<SampleAsset> | null
    const result = response?.data?.assetsSearch
    if (!result) throw new Error("Could not load pack samples")
    return result
}

export async function fetchAllPackSamples(packUuid: string) {
    const samples = new Map<string, SampleAsset>()
    let lastPage = 1
    for (let page = 1; page <= lastPage; page++) {
        const result = await fetchPackSamplesPage(packUuid, page)
        for (const sample of result.items) samples.set(sample.uuid, sample)
        lastPage = result.pagination_metadata?.totalPages ?? page
    }
    return [...samples.values()]
}
