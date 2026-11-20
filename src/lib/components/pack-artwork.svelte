<script lang="ts">
    import Package from "lucide-svelte/icons/package"
    import type { PackAsset } from "$lib/splice/types"
    import { cn } from "$lib/utils"

    let {
        pack, size = 12, downloadProgress, class: className,
    }: {
        pack?: PackAsset
        size?: number
        downloadProgress?: number | null
        class?: string
    } = $props()
    let failedImage = $state<string | undefined>()
    const image = $derived(pack?.files?.[0]?.url)
    const pending = $derived(downloadProgress !== undefined)
</script>

<span
    class={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground", className)}
    style:width={`${size / 4}rem`}
    style:height={`${size / 4}rem`}
>
    <Package class="size-1/2" aria-hidden="true" />
    {#if image && image !== failedImage}
        <img src={image} alt="" class="absolute inset-0 size-full object-cover" loading="lazy" draggable="false"
            onerror={() => (failedImage = image)} />
    {/if}
    {#if pending}
        <span
            role="progressbar"
            aria-label="Downloading sample"
            aria-valuenow={typeof downloadProgress === "number" ? Math.round(downloadProgress * 100) : undefined}
            class="pointer-events-none absolute inset-0 overflow-hidden ring-1 ring-inset ring-primary/50"
        >
            {#if typeof downloadProgress === "number"}
                <span class="absolute inset-x-0 bottom-0 border-t border-white/65 bg-black/35"
                    style:height={`${Math.max(5, downloadProgress * 100)}%`}></span>
            {:else}
                <span class="download-sweep absolute inset-x-0 bottom-0 h-2/5 bg-black/35"></span>
            {/if}
        </span>
    {/if}
</span>

<style>
    .download-sweep { animation: sweep 1.5s ease-in-out infinite alternate; }
    @keyframes sweep { to { transform: translateY(-150%); } }
    @media (prefers-reduced-motion: reduce) {
        .download-sweep { animation: none; }
    }
</style>
