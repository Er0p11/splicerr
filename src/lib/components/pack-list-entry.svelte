<script lang="ts">
    import Heart from "lucide-svelte/icons/heart"
    import PackArtwork from "./pack-artwork.svelte"
    import PackMenu from "./pack-menu.svelte"
    import type { PackAsset } from "$lib/splice/types"
    import { openPack } from "$lib/shared/view.svelte"
    import { LIKES_UUID, isPackInCollection } from "$lib/shared/collections.svelte"
    import { packDownloads } from "$lib/shared/pack-download.svelte"

    let { pack, collectionUuid = null }: { pack: PackAsset; collectionUuid?: string | null } = $props()
    const favorite = $derived(isPackInCollection(LIKES_UUID, pack.uuid))
    const download = $derived(packDownloads.get(pack.uuid))
</script>

<div class="glass-row flex shrink-0 items-center gap-3 rounded-xl p-2" data-pack-row={pack.uuid}>
    <button class="flex min-w-0 flex-1 items-center gap-3 text-left" onclick={() => openPack(pack)}>
        <PackArtwork {pack} size={10} />
        <span class="flex min-w-0 flex-col gap-0.5">
            <span class="truncate text-sm font-medium">{pack.name}</span>
            {#if download}
                <span class="text-xs tabular-nums text-muted-foreground">
                    {download.total ? `${download.done} of ${download.total} WAVs` : "Preparing pack…"}
                </span>
            {/if}
        </span>
    </button>
    {#if favorite}<Heart class="size-4 shrink-0 text-primary" fill="currentColor" aria-label="In Likes" />{/if}
    <PackMenu {pack} {collectionUuid} side="left" />
</div>
