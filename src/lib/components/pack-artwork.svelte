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
            class="download-ring pointer-events-none absolute inset-0"
            class:indeterminate={downloadProgress === null}
            style:--download-progress={`${Math.max(4, (downloadProgress ?? 0) * 100)}%`}
        ></span>
    {/if}
</span>

<style>
    @property --download-progress {
        syntax: "<percentage>";
        inherits: false;
        initial-value: 4%;
    }
    @property --download-phase {
        syntax: "<angle>";
        inherits: false;
        initial-value: 0deg;
    }
    .download-ring {
        --fill: #72ffd8;
        --track: #0b2229d6;
        border-radius: inherit;
        padding: 2px;
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask-composite: exclude;
        background: conic-gradient(var(--fill) var(--download-progress), var(--track) 0);
        transition: --download-progress 120ms ease-out;
    }
    .indeterminate {
        background: conic-gradient(from var(--download-phase), var(--fill) 24%, var(--track) 0);
        animation: sweep 1.2s linear infinite;
    }
    @keyframes sweep { to { --download-phase: 360deg; } }
    @media (prefers-reduced-motion: reduce) {
        .download-ring { animation: none; transition: none; }
    }
</style>
