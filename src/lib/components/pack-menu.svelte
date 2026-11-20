<script lang="ts">
    import ArrowLeft from "lucide-svelte/icons/arrow-left"
    import AudioLines from "lucide-svelte/icons/audio-lines"
    import Check from "lucide-svelte/icons/check"
    import Download from "lucide-svelte/icons/download"
    import Ellipsis from "lucide-svelte/icons/ellipsis"
    import ExternalLink from "lucide-svelte/icons/external-link"
    import FolderOpen from "lucide-svelte/icons/folder-open"
    import Heart from "lucide-svelte/icons/heart"
    import ListPlus from "lucide-svelte/icons/list-plus"
    import Plus from "lucide-svelte/icons/plus"
    import Trash2 from "lucide-svelte/icons/trash-2"
    import { openUrl } from "@tauri-apps/plugin-opener"
    import * as Popover from "$lib/components/ui/popover"
    import PackArtwork from "./pack-artwork.svelte"
    import type { PackAsset } from "$lib/splice/types"
    import {
        LIKES_UUID, isPackInCollection, openNewCollectionDialog, setPackInCollection, userCollections,
    } from "$lib/shared/collections.svelte"
    import { downloadPack, packDownloads } from "$lib/shared/pack-download.svelte"
    import { openPack } from "$lib/shared/view.svelte"
    import { toast } from "$lib/shared/toasts.svelte"

    let {
        pack, thumbnail = false, size = 12, side = "right", downloadProgress, collectionUuid = null,
    }: {
        pack: PackAsset
        thumbnail?: boolean
        size?: number
        side?: "left" | "right" | "top" | "bottom"
        downloadProgress?: number | null
        collectionUuid?: string | null
    } = $props()

    let open = $state(false)
    let choosingCollection = $state(false)
    const favorite = $derived(isPackInCollection(LIKES_UUID, pack.uuid))
    const download = $derived(packDownloads.get(pack.uuid))
    const itemClass = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"

    function setSaved(uuid: string, included: boolean) {
        void setPackInCollection(uuid, pack, included).catch((error) => {
            console.error("Could not save pack", error)
            toast({ title: "Could not save pack", variant: "error" })
        })
    }

    function startDownload(chooseFolder: boolean) {
        open = false
        void downloadPack(pack, chooseFolder)
    }
</script>

<Popover.Root bind:open onOpenChange={(next) => {
    if (next) choosingCollection = false
}}>
    <Popover.Trigger
        class={thumbnail ? "shrink-0 rounded-lg" : "grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"}
        aria-label={`Pack actions · ${pack.name}`}
        title={pack.name}
    >
        {#if thumbnail}
            <PackArtwork {pack} {size} {downloadProgress} />
        {:else}
            <Ellipsis class="size-4" />
        {/if}
    </Popover.Trigger>
    <Popover.Content {side} align="start" class="w-64 p-1">
        {#if choosingCollection}
            <button class={itemClass} onclick={() => (choosingCollection = false)}>
                <ArrowLeft class="size-4" /> Add pack to collection
            </button>
            <div class="max-h-48 overflow-y-auto">
                {#each userCollections() as collection (collection.uuid)}
                    {@const included = isPackInCollection(collection.uuid, pack.uuid)}
                    <button class={itemClass} aria-pressed={included} onclick={() => setSaved(collection.uuid, !included)}>
                        <span class="grid size-4 shrink-0 place-items-center">
                            {#if included}<Check class="size-4" />{/if}
                        </span>
                        <span class="truncate">{collection.name}</span>
                    </button>
                {/each}
            </div>
            <button class={itemClass} onclick={() => {
                open = false
                openNewCollectionDialog(pack)
            }}><Plus class="size-4" /> New collection</button>
        {:else}
            <div class="truncate px-2 py-1.5 text-xs font-medium text-muted-foreground">{pack.name}</div>
            <button class={itemClass} onclick={() => {
                open = false
                openPack(pack)
            }}><AudioLines class="size-4" /> Show pack samples</button>
            <button class={itemClass} aria-pressed={favorite} onclick={() => setSaved(LIKES_UUID, !favorite)}>
                <Heart class="size-4" fill={favorite ? "currentColor" : "none"} />
                {favorite ? "Remove from Likes" : "Add pack to Likes"}
            </button>
            <button class={itemClass} onclick={() => (choosingCollection = true)}>
                <ListPlus class="size-4" /> Add pack to collection
            </button>
            {#if collectionUuid && collectionUuid !== LIKES_UUID}
                <button class={itemClass} onclick={() => {
                    open = false
                    setSaved(collectionUuid!, false)
                }}><Trash2 class="size-4" /> Remove pack from collection</button>
            {/if}
            <div class="my-1 border-t border-border"></div>
            <button class={itemClass} disabled={!!download} onclick={() => startDownload(false)}>
                <Download class="size-4" /> {download ? "Downloading pack…" : "Download pack"}
            </button>
            <button class={itemClass} disabled={!!download} onclick={() => startDownload(true)}>
                <FolderOpen class="size-4" /> Download pack to…
            </button>
            {#if pack.permalink_base_url && pack.permalink_slug}
                <button class={itemClass} onclick={() => {
                    open = false
                    void openUrl(`https://splice.com/sounds/packs/${encodeURIComponent(pack.permalink_base_url)}/${encodeURIComponent(pack.permalink_slug)}`)
                }}><ExternalLink class="size-4" /> Open on Splice</button>
            {/if}
        {/if}
    </Popover.Content>
</Popover.Root>
