import { fetchPacksPage } from "$lib/splice/packs"
import type { PackAsset } from "$lib/splice/types"

export const packsStore = $state({
    query: "",
    items: [] as PackAsset[],
    total: 0,
    loading: false,
    error: false,
})

let currentQuery: string | null = null
let requestId = 0
let page = 0
let lastPage = 0
let retryMore = false

export async function searchPacks(more = false) {
    const query = packsStore.query
    if (more && (packsStore.loading || query !== currentQuery || page >= lastPage)) return
    const nextPage = more ? page + 1 : 1
    const id = ++requestId
    if (!more && currentQuery !== query) {
        packsStore.items = []
        packsStore.total = 0
    }
    packsStore.loading = true
    packsStore.error = false
    try {
        const result = await fetchPacksPage(query, nextPage)
        if (id !== requestId || query !== packsStore.query) return
        const unique = new Map((more ? packsStore.items : []).map((pack) => [pack.uuid, pack]))
        for (const pack of result.items) unique.set(pack.uuid, pack)
        packsStore.items = [...unique.values()]
        packsStore.total = result.response_metadata.records
        currentQuery = query
        page = nextPage
        lastPage = result.pagination_metadata?.totalPages ?? page
    } catch (error) {
        if (id !== requestId || query !== packsStore.query) return
        console.error("Could not load packs", error)
        retryMore = more
        packsStore.error = true
    } finally {
        if (id === requestId) packsStore.loading = false
    }
}

export function loadPacks() {
    if (currentQuery === null && !packsStore.loading) void searchPacks()
}

export function retryPacks() {
    void searchPacks(retryMore && currentQuery === packsStore.query)
}
